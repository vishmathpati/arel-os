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

import { GatewayError, gateway } from "@ai-sdk/gateway";
import { APICallError, generateText } from "ai";
import { listVaultDir } from "../io.ts";
import { readEngineConfig } from "./config.ts";
import { loadRecipe } from "./recipe.ts";
import { nextDue, parseTrigger } from "./schedule.ts";

export type HealthStatus = "ok" | "down" | "warn";

/**
 * Machine-readable reason code for a "gmail" dependency failure, alongside its
 * human `detail` string — lets the UI show a specific fix (e.g. an install
 * guide) instead of pattern-matching the detail text. Absent for dependencies
 * where a structured reason isn't needed.
 */
export type GmailFailureReason = "not-installed" | "not-authenticated" | "other";

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
  /** Structured failure reason — currently only populated for the "gmail" dependency. */
  reason?: GmailFailureReason;
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

/**
 * Is the `gws` (Google Workspace CLI) binary on PATH at all? A cheap, separate
 * check from full auth — `gws --version` never touches the network or needs
 * credentials, so this isolates "not installed" from "installed but not
 * signed in" without waiting on the slower `checkGmail` probe below. Exported
 * so other surfaces (e.g. a recipe's install-guide panel) can ask the same
 * question directly instead of parsing `checkGmail`'s prose.
 */
export async function isGwsOnPath(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["gws", "--version"], { stdout: "ignore", stderr: "ignore" });
    const code = await proc.exited;
    return code === 0;
  } catch {
    // Bun.spawn throws synchronously when the binary isn't on PATH.
    return false;
  }
}

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
          reason: "not-authenticated",
          detail: "Gmail sign-in has expired or failed — it needs to be re-authenticated.",
        };
      }
      return {
        ...base,
        status: "down",
        reason: "other",
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
      reason: "not-installed",
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
 * Onboarding/settings AI-key gate validation result — honest, distinct states
 * (no fake positives). Beyond the original ok/invalid-key/unreachable:
 *   - "model-error" — the key is fine, but the *model* is unusable (not found,
 *     or the account/plan can't run it). Reported separately from "invalid-key"
 *     so the UI never tells someone their key is bad when it's the model slug
 *     that's wrong.
 *   - "rate-limited" — the key is fine, the gateway is just throttling us
 *     right now (429). Distinct from "unreachable" so the user knows to wait,
 *     not to re-check their key or network.
 *   - "no-credit" — the key is fine, but the gateway account has no spend
 *     available (402). Distinct so the user knows to add credit, not to
 *     re-paste the key.
 */
export type GatewayKeyValidation =
  | { status: "ok"; detail: string }
  | { status: "invalid-key"; detail: string }
  | { status: "model-error"; detail: string }
  | { status: "rate-limited"; detail: string }
  | { status: "no-credit"; detail: string }
  | { status: "unreachable"; detail: string };

/**
 * Onboarding AI-key gate validation (spec §5.2): a genuinely authenticated probe
 * right after a key is written to `.env`, so the user gets an honest pass/fail
 * before leaving the wizard.
 *
 * `gateway.getAvailableModels()` (used by `checkModel` above) is NOT sufficient
 * here — it succeeds even with a completely fake key (it just lists the public
 * catalog, which requires no auth). This probe instead runs a minimal real
 * completion (`generateText`, 1-word prompt, `maxOutputTokens: 16`) through the
 * same Vercel AI Gateway client the Engine uses (see engine.ts) against the
 * configured default model — the cheapest call that actually exercises auth.
 *
 * `maxOutputTokens` MUST be >= 16: confirmed live that the gateway rejects
 * `maxOutputTokens: 8` with a 400 "integer below minimum value" error before
 * the model ever runs — that 400 has nothing to do with the key, but with the
 * old classifier it fell through to a misleading "unreachable" result on every
 * single validation, even with a perfectly good key (the exact bug reported:
 * "added the key but it shows an error"). 16 is the gateway's enforced floor.
 *
 * Errors are classified, not lumped together. Confirmed live against a fake
 * key: the `ai` package's gateway wrapper (`wrapGatewayError` in
 * ai/dist/index.mjs) rethrows a 401 from the gateway as a plain `Error` named
 * `"GatewayAuthenticationError"` (dev) or `"GatewayError"` (prod) — it does
 * NOT preserve `GatewayError`'s class/marker or a `statusCode`, so
 * `GatewayError.isInstance()` returns false and `err.name` is the only signal.
 * `GatewayForbiddenError`/`APICallError` statusCodes are also checked in case
 * a future SDK version or a direct-provider route surfaces 401/403 differently.
 *   - name/message matching an auth failure, a 401/403 statusCode, or a
 *     missing-key load error → "invalid-key" — the key itself is bad.
 *   - a model-not-found error, or a 400 whose message names the model
 *     → "model-error" — the key is fine, the model slug isn't usable.
 *   - a 402 (no credit) → "no-credit" — the key is fine, the account is out
 *     of funds.
 *   - a 429 (rate limited) → "rate-limited" — the key is fine, try again soon.
 *   - anything else (network, timeout, 5xx, unknown) → "unreachable" — we
 *     couldn't tell either way, so we don't accuse the key of being wrong.
 */
export async function validateGatewayKey(): Promise<GatewayKeyValidation> {
  let model: string;
  try {
    const config = await readEngineConfig();
    model = config.defaultModel || process.env.ARELOS_ENGINE_MODEL || "";
  } catch {
    model = process.env.ARELOS_ENGINE_MODEL ?? "";
  }
  if (!model) {
    return {
      status: "unreachable",
      detail: "No model is configured yet — set a default model before testing the key.",
    };
  }

  try {
    await generateText({
      model,
      prompt: "hi",
      maxOutputTokens: 16,
    });
    return { status: "ok", detail: "Your key works — recipes can run." };
  } catch (err) {
    if (isInvalidKeyError(err)) {
      return {
        status: "invalid-key",
        detail: "That key was rejected — double-check it and try again.",
      };
    }
    if (isModelError(err)) {
      return {
        status: "model-error",
        detail: `Your key works, but the configured model ("${model}") isn't usable right now — pick a different model.`,
      };
    }
    if (isNoCreditError(err)) {
      return {
        status: "no-credit",
        detail: "Your key works, but the account has no credit left — add funds to run recipes.",
      };
    }
    if (isRateLimitError(err)) {
      return {
        status: "rate-limited",
        detail:
          "Your key works, but the AI service is rate-limiting requests right now — try again shortly.",
      };
    }
    return {
      status: "unreachable",
      detail: "Couldn't reach the AI service to test the key. Check your connection and try again.",
    };
  }
}

function gatewayStatusCode(err: unknown): number | undefined {
  if (GatewayError.isInstance(err)) return err.statusCode;
  if (APICallError.isInstance(err)) return err.statusCode;
  return undefined;
}

/** True when `err` represents an authentication failure — a rejected/missing key. */
function isInvalidKeyError(err: unknown): boolean {
  const statusCode = gatewayStatusCode(err);
  if (statusCode === 401 || statusCode === 403) return true;

  if (!(err instanceof Error)) return false;
  // The gateway wrapper (ai/dist: wrapGatewayError) rethrows an auth failure as
  // a bare Error named "GatewayAuthenticationError" (dev) / "GatewayError"
  // (prod) with no statusCode — matched by name, confirmed live.
  if (err.name === "GatewayAuthenticationError" || err.name === "AI_LoadAPIKeyError") return true;
  if (err.name === "GatewayError" && /unauthenticat/i.test(err.message)) return true;
  return false;
}

/**
 * True when the gateway rejected the *model*, not the key — e.g.
 * `GatewayModelNotFoundError`, or an `invalid_request_error`/generic 400 whose
 * message is about the model/request shape rather than auth. Deliberately
 * narrow: only matches known model/request-shape language, so an unrelated
 * 400 doesn't get miscast as "model-error" instead of "unreachable".
 */
function isModelError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  if (err.name === "GatewayModelNotFoundError") return true;
  if (err.name === "GatewayInvalidRequestError" || err.name === "GatewayInternalServerError") {
    return /model|max_output_tokens|max_tokens|context.?window|not found/i.test(err.message);
  }
  return false;
}

/** True on a 402 — the key is valid but the gateway account has no spend available. */
function isNoCreditError(err: unknown): boolean {
  if (gatewayStatusCode(err) === 402) return true;
  return (
    err instanceof Error && /insufficient credit|out of credit|payment required/i.test(err.message)
  );
}

/** True on a 429 — the key is valid but the gateway is throttling this account. */
function isRateLimitError(err: unknown): boolean {
  if (gatewayStatusCode(err) === 429) return true;
  return err instanceof Error && err.name === "GatewayRateLimitError";
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
