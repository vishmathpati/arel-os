/**
 * Recipe health checks — the "quality control" layer. A recipe is only as good
 * as the tools it depends on: if the Gmail CLI can't authenticate or the model
 * isn't reachable, the model can't do anything no matter how good the prompt is.
 *
 * This module probes each dependency a recipe actually uses (derived from its
 * allowed-tools) and reports a human-readable status + reason. The Recipes UI
 * polls `GET /engine/health` on an interval so the checks run continuously, not
 * once-and-forget. Results are cached briefly so polling several recipes that
 * share a dependency doesn't hammer the same probe.
 */

import { gateway } from "@ai-sdk/gateway";
import { listVaultDir } from "../io.ts";
import { readEngineConfig } from "./config.ts";
import { loadRecipe } from "./recipe.ts";
import { nextDue, parseTrigger } from "./schedule.ts";

export type HealthStatus = "ok" | "down" | "warn";

/** One dependency's live status, written for a human (no jargon, no paths). */
export interface DependencyHealth {
  /** Stable key: "gmail" | "model" | "currency" | "vault". */
  key: string;
  /** Human label, e.g. "Gmail access" or "AI model". */
  label: string;
  status: HealthStatus;
  /** Plain-English explanation of the status — what's working, or what's wrong and why. */
  detail: string;
  /** ISO timestamp when this was last actually probed. */
  checkedAt: string;
}

/** A recipe's overall health = the roll-up of its dependency checks. */
export interface RecipeHealth {
  recipe: string;
  /** "ok" = all good · "warn" = something degraded · "down" = a hard dependency is broken. */
  overall: HealthStatus;
  dependencies: DependencyHealth[];
  checkedAt: string;
}

// ── tiny TTL cache so overlapping polls dedupe a probe ──────────────────────────

interface CacheEntry {
  at: number;
  value: DependencyHealth;
}
const cache = new Map<string, CacheEntry>();

async function probe(
  key: string,
  ttlMs: number,
  fresh: boolean,
  fn: () => Promise<DependencyHealth>,
): Promise<DependencyHealth> {
  const now = Date.now();
  if (!fresh) {
    const hit = cache.get(key);
    if (hit && now - hit.at < ttlMs) return hit.value;
  }
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

function nowIso(): string {
  return new Date().toISOString();
}

// ── individual probes ───────────────────────────────────────────────────────────

/** Gmail (the `gws` CLI): is the binary reachable AND is the account authenticated? */
async function checkGmail(): Promise<DependencyHealth> {
  const base = { key: "gmail", label: "Gmail access", checkedAt: nowIso() };
  try {
    const proc = Bun.spawn(["gws", "gmail", "users", "getProfile", "--params", '{"userId":"me"}'], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const killer = setTimeout(() => proc.kill(), 15_000);
    let out = "";
    let err = "";
    try {
      [out, err] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const code = await proc.exited;
      if (code === 0) {
        // getProfile returns { emailAddress, messagesTotal, ... }
        const start = out.indexOf("{");
        let email = "";
        if (start >= 0) {
          try {
            email = (JSON.parse(out.slice(start)) as { emailAddress?: string }).emailAddress ?? "";
          } catch {
            // tolerate a leading warning line / non-JSON noise
          }
        }
        return {
          ...base,
          status: "ok",
          detail: email ? `Connected to ${email}.` : "Connected and signed in.",
        };
      }
      const blob = `${out}\n${err}`.toLowerCase();
      if (/401|credential|auth|login|denied|token/.test(blob)) {
        return {
          ...base,
          status: "down",
          detail: "Gmail sign-in has expired or failed — it needs to be re-authenticated.",
        };
      }
      return {
        ...base,
        status: "down",
        detail: "The Gmail tool returned an error and couldn't read your mailbox.",
      };
    } finally {
      clearTimeout(killer);
    }
  } catch {
    // Bun.spawn throws when the binary isn't on PATH — the exact bug we hit before.
    return {
      ...base,
      status: "down",
      detail: "The Gmail tool isn't installed where the automation runs (it can't be found).",
    };
  }
}

let modelCatalog: { at: number; map: Map<string, string> } | null = null;

/** Fetch (and cache) the gateway's model catalog — also validates the API key. */
async function modelMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (modelCatalog && now - modelCatalog.at < 5 * 60_000) return modelCatalog.map;
  const meta = (await gateway.getAvailableModels()) as {
    models?: { id: string; name?: string }[];
  };
  const map = new Map<string, string>();
  for (const m of meta.models ?? []) map.set(m.id, m.name ?? m.id);
  modelCatalog = { at: now, map };
  return map;
}

/** AI model: is the gateway reachable (key valid) AND is the recipe's model available? */
async function checkModel(slug: string): Promise<DependencyHealth> {
  const base = { key: "model", label: "AI model", checkedAt: nowIso() };
  try {
    const map = await modelMap();
    if (map.has(slug)) {
      return { ...base, status: "ok", detail: `${map.get(slug)} is ready.` };
    }
    return {
      ...base,
      status: "warn",
      detail: `The selected model isn't available right now. Pick a different model.`,
    };
  } catch {
    return {
      ...base,
      status: "down",
      detail: "Couldn't reach the AI service — the access key may be missing or invalid.",
    };
  }
}

/**
 * Onboarding AI-key gate validation (spec §5.2): a cheap, real ping through the
 * gateway client right after a key is written to `.env`, so the user gets an
 * honest pass/fail before leaving the wizard. Reuses the same
 * `gateway.getAvailableModels()` call `checkModel` uses (lists the model
 * catalog — no generation, no token spend) but always bypasses the cache since
 * we just changed the key `modelMap`'s cache would otherwise mask.
 */
export async function validateGatewayKey(): Promise<{ ok: boolean; detail: string }> {
  modelCatalog = null; // force a fresh call — the cached catalog may predate the new key
  try {
    const map = await modelMap();
    return {
      ok: true,
      detail:
        map.size > 0
          ? "Your key works — recipes can run."
          : "Key accepted, but no models were returned.",
    };
  } catch {
    return { ok: false, detail: "That key didn't validate. Double-check and try again." };
  }
}

/** Currency rates (web-fetch): is the exchange-rate service reachable? */
async function checkCurrency(): Promise<DependencyHealth> {
  const base = { key: "currency", label: "Currency rates", checkedAt: nowIso() };
  try {
    const res = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR", {
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      return { ...base, status: "ok", detail: "Live exchange rates are reachable." };
    }
    return { ...base, status: "down", detail: "The currency-rate service isn't responding." };
  } catch {
    return { ...base, status: "down", detail: "Couldn't reach the currency-rate service." };
  }
}

/** Vault storage: can the automation read and write your notes folder? */
async function checkVault(): Promise<DependencyHealth> {
  const base = { key: "vault", label: "Vault storage", checkedAt: nowIso() };
  try {
    await listVaultDir("databases");
    return { ...base, status: "ok", detail: "Your vault is reachable and writable." };
  } catch {
    return { ...base, status: "down", detail: "The vault folder couldn't be reached." };
  }
}

/**
 * Automatic-run wiring: is this recipe's schedule something the scheduler can
 * actually fire? Returns null for manual recipes (no auto-run is expected).
 */
function checkSchedule(trigger: string, schedule: string | undefined): DependencyHealth | null {
  const base = { key: "schedule", label: "Automatic runs", checkedAt: nowIso() };
  const effective = (schedule ?? trigger).trim();
  const lower = effective.toLowerCase();
  const wantsSchedule = !!schedule || (lower !== "on-demand" && lower !== "manual" && lower !== "");
  if (!wantsSchedule) return null; // a manual recipe — auto-run isn't expected

  const rule = parseTrigger(effective);
  if (!rule) {
    return {
      ...base,
      status: "warn",
      detail:
        "Set to run on a schedule, but the schedule couldn't be read — it won't run on its own. Run it manually.",
    };
  }
  const when = nextDue(rule, new Date()).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return { ...base, status: "ok", detail: `Runs automatically. Next run ${when}.` };
}

// ── roll-up ───────────────────────────────────────────────────────────────────

function overallOf(deps: DependencyHealth[]): HealthStatus {
  if (deps.some((d) => d.status === "down")) return "down";
  if (deps.some((d) => d.status === "warn")) return "warn";
  return "ok";
}

/** Probe every dependency a recipe uses (derived from its allowed-tools). */
export async function getRecipeHealth(name: string, fresh = false): Promise<RecipeHealth> {
  const [recipe, config] = await Promise.all([loadRecipe(name), readEngineConfig()]);
  const recipeConfig = config.recipes[name];
  const tools = new Set(recipe.meta.allowedTools);
  const checks: Promise<DependencyHealth>[] = [];

  // Every recipe needs a model — mirror engine.ts resolution (override → SKILL.md → global).
  const model =
    recipeConfig?.model ??
    recipe.meta.model ??
    config.defaultModel ??
    process.env.ARELOS_ENGINE_MODEL ??
    "";
  checks.push(probe(`model:${model}`, 30_000, fresh, () => checkModel(model)));

  if (tools.has("gws")) checks.push(probe("gmail", 15_000, fresh, checkGmail));
  if (tools.has("web-fetch")) checks.push(probe("currency", 30_000, fresh, checkCurrency));
  if (tools.has("vault-read") || tools.has("vault-list") || tools.has("vault-write")) {
    checks.push(probe("vault", 30_000, fresh, checkVault));
  }

  const dependencies = await Promise.all(checks);

  // Schedule wiring is a pure check (no IO) — honors the per-recipe override.
  const sched = checkSchedule(recipe.meta.trigger, recipeConfig?.schedule ?? recipe.meta.schedule);
  if (sched) dependencies.push(sched);

  return { recipe: name, overall: overallOf(dependencies), dependencies, checkedAt: nowIso() };
}
