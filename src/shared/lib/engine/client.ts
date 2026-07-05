/**
 * Frontend engine client — typed wrappers over the Bun engine server's HTTP
 * endpoints (server/engine). Browser-only (uses fetch). Mirrors the vault client
 * (src/shared/lib/vault/client.ts): same base URL (the vault + engine server
 * share one process), same `unwrap` error contract.
 */

import { VAULT_API as BASE_URL } from "@/shared/lib/vault/base-url";

/** A non-2xx response carries `{ error }` JSON; surface it as an Error. */
async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // non-JSON error body — keep the status line
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** The last run of a recipe, as surfaced in the list. */
export interface RecipeLastRun {
  status: "ok" | "failed";
  /** ISO timestamp of when the run finished. */
  at: string;
  /** Short result summary (ok) or error message (failed). */
  summary: string;
}

/** One recipe, as listed by GET /engine/recipes (config + meta + last-run merged). */
export interface RecipeListItem {
  name: string;
  description: string;
  /** "on-demand", "manual", "scheduled", or a schedule string. */
  trigger: string;
  /** Effective schedule string (per-recipe override ?? SKILL.md). */
  schedule?: string;
  /** Per-recipe schedule override only (absent = inheriting SKILL.md). */
  scheduleOverride?: string;
  /** Per-recipe model override only (absent = using the global default). */
  modelOverride?: string;
  /** Per-recipe fallback override only (absent = using the global fallback). */
  fallbackOverride?: string;
  /** The model the recipe resolves to (override or default). */
  model: string;
  /** The most recent run, or null if the recipe has never run. */
  lastRun: RecipeLastRun | null;
  /** Whether the Engine will run this recipe. */
  enabled: boolean;
  /** Total number of structured run records (0 if never run). */
  runCount: number;
}

/** Per-recipe overrides keyed by recipe name. Empty string on model/fallback/schedule clears it. */
export interface RecipeConfig {
  model?: string;
  fallback?: string;
  enabled?: boolean;
  schedule?: string;
}

/** The Engine's model configuration. */
export interface EngineConfig {
  defaultModel: string;
  fallbackModel: string;
  /** The catalog of selectable model slugs. */
  models: string[];
  /** Per-recipe overrides, keyed by recipe name. */
  recipes: Record<string, RecipeConfig>;
}

/** The outcome of one run (POST /engine/run). */
export interface RunOutcome {
  status: "ok" | "failed";
  trigger: string;
  model: string;
  durationMs: number;
  totalTokens: number;
  /** Short result summary (ok) or error message (failed). */
  summary: string;
  /** Full model output text (ok runs only). */
  text?: string;
}

/** GET /engine/recipes — the recipe list (config + meta + last-run merged). */
export async function listRecipes(): Promise<{ recipes: RecipeListItem[] }> {
  return unwrap(await fetch(`${BASE_URL}/engine/recipes`));
}

/** GET /engine/config — the Engine's model configuration. */
export async function readEngineConfig(): Promise<EngineConfig> {
  return unwrap(await fetch(`${BASE_URL}/engine/config`));
}

/** POST /engine/config — merge a partial config; returns the updated config. */
export async function writeEngineConfig(partial: Partial<EngineConfig>): Promise<EngineConfig> {
  return unwrap(
    await fetch(`${BASE_URL}/engine/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    }),
  );
}

/** A single vault write captured during a run (created or updated). */
export interface VaultChange {
  op: "created" | "updated";
  /** Internal vault path — never shown in the UI. */
  path: string;
  /** Human label (the written file's title), e.g. "Surfshark". */
  label?: string;
  /** Human noun: "transaction" | "subscription" | "card" | "bank account" | "summary" | "log" | … */
  kind?: string;
  /** Human money value, e.g. "₹279" or "₹32,390 outstanding". */
  amount?: string;
}

/** One structured run record from GET /engine/runs. */
export interface RunRecord {
  at: string;
  status: "ok" | "failed";
  trigger: string;
  model: string;
  durationMs: number;
  totalTokens: number;
  /** Input tokens served from cache (0/absent if none). */
  cachedTokens?: number;
  summary: string;
  changes: VaultChange[];
}

/** Per-recipe scheduler state entry from GET /engine/schedule. */
export interface SchedulerEntry {
  next_due: string | null;
  last_fired: string | null;
  last_status: "ok" | "failed" | null;
}

/** GET /engine/runs — run history for one recipe (newest-first). */
export async function listRuns(name: string, limit = 50): Promise<{ runs: RunRecord[] }> {
  return unwrap(
    await fetch(`${BASE_URL}/engine/runs?recipe=${encodeURIComponent(name)}&limit=${limit}`),
  );
}

/** GET /engine/schedule — scheduler state (next_due + last_fired per recipe). */
export async function readScheduleState(): Promise<Record<string, SchedulerEntry>> {
  return unwrap(await fetch(`${BASE_URL}/engine/schedule`));
}

/** Live status of one dependency a recipe relies on (Gmail, model, etc.). */
export type HealthStatus = "ok" | "down" | "warn";
export interface DependencyHealth {
  key: string;
  label: string;
  status: HealthStatus;
  /** Plain-English explanation of the status. */
  detail: string;
  /** ISO timestamp of when this dependency was last probed. */
  checkedAt: string;
}

/** A recipe's overall health — the roll-up of its dependency checks. */
export interface RecipeHealth {
  recipe: string;
  overall: HealthStatus;
  dependencies: DependencyHealth[];
  checkedAt: string;
}

/** GET /engine/health?recipe=<name> — one recipe's live dependency health. */
export async function getRecipeHealth(name: string, fresh = false): Promise<RecipeHealth> {
  const q = `recipe=${encodeURIComponent(name)}${fresh ? "&fresh=1" : ""}`;
  return unwrap(await fetch(`${BASE_URL}/engine/health?${q}`));
}

/** GET /engine/health — every recipe's health, keyed by name (for the index). */
export async function getAllHealth(): Promise<Record<string, RecipeHealth>> {
  return unwrap(await fetch(`${BASE_URL}/engine/health`));
}

/** POST /engine/run — run a recipe on demand. Can take ~60–90s. */
export async function runRecipe(name: string, input?: string): Promise<RunOutcome> {
  return unwrap(
    await fetch(`${BASE_URL}/engine/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input === undefined ? { name } : { name, input }),
    }),
  );
}
