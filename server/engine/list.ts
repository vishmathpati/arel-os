/**
 * Recipe listing — scans system/recipes for recipe folders, loads each one's
 * meta, reads the last run line from its log.md, and merges in the Engine config
 * (enabled flag + resolved model). This is what powers GET /engine/recipes: one
 * row per recipe with enough to render a list and a run button.
 *
 * The resolved model mirrors the Engine's resolution order (config override →
 * recipe SKILL.md → global default), minus the env fallback, so the UI shows the
 * same model a run would use.
 */

import { VAULT_DIRS, recipeLogPath } from "../../src/shared/lib/vault/paths.ts";
import { VaultNotFoundError, listVaultDir, readVaultFile } from "../io.ts";
import { readEngineConfig } from "./config.ts";
import { loadRecipe } from "./recipe.ts";
import { countRunRecords } from "./runlog.ts";

/** The last run parsed out of a recipe's log.md. */
export interface RecipeLastRun {
  status: "ok" | "failed";
  /** Run timestamp as written in the log ("YYYY-MM-DD HH:MM"). */
  at: string;
  /** Short result summary or error message. */
  summary: string;
}

/** One row in the GET /engine/recipes response. */
export interface RecipeListItem {
  name: string;
  description?: string;
  trigger: string;
  /** Effective schedule (per-recipe override ?? SKILL.md schedule); used for display + firing. */
  schedule?: string;
  /** The per-recipe schedule override only (absent = inheriting SKILL.md). For the editor. */
  scheduleOverride?: string;
  /** Whether the Engine will run it (config override; defaults to true). */
  enabled: boolean;
  /** The model a run would resolve to (config override → recipe → default). */
  model: string;
  /** Per-recipe model override only (absent = using the global default). For the picker. */
  modelOverride?: string;
  /** Per-recipe fallback override only (absent = using the global fallback). For the picker. */
  fallbackOverride?: string;
  /** The most recent run, or null if the recipe has never run. */
  lastRun: RecipeLastRun | null;
  /** Total number of structured run records (0 if never run). */
  runCount: number;
}

/**
 * Parse the last non-comment line of a recipe's log.md into a RecipeLastRun.
 * The log format is fixed by log.ts:
 *   `[YYYY-MM-DD HH:MM] status · trigger=… · model=… · Xs · Ntok · summary`
 * Returns null when there are no runs (missing/empty log).
 */
async function readLastRun(name: string): Promise<RecipeLastRun | null> {
  let raw: string;
  try {
    const doc = await readVaultFile(recipeLogPath(name));
    // log.md is a plain text log (no frontmatter), so body is the whole file.
    raw = doc.body;
  } catch (err) {
    if (err instanceof VaultNotFoundError) return null;
    throw err;
  }

  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("<!--"));
  const last = lines.at(-1);
  if (!last) return null;

  const match = last.match(/^\[([^\]]+)\]\s+(\S+)/);
  if (!match) return null;
  const at = match[1].trim();
  const status = match[2].toUpperCase() === "FAILED" ? "failed" : "ok";

  // Summary is the segment after the final " · " separator.
  const parts = last.split(" · ");
  const summary = (parts.at(-1) ?? "").trim();

  return { status, at, summary };
}

/**
 * List every recipe under system/recipes (subdirectories only — the shared
 * context.md and config.md files are skipped), merged with the Engine config.
 */
export async function listRecipes(): Promise<RecipeListItem[]> {
  const entries = await listVaultDir(VAULT_DIRS.recipes);
  const config = await readEngineConfig();

  const items: RecipeListItem[] = [];
  for (const entry of entries) {
    if (entry.type !== "dir") continue; // skip context.md / config.md and any stray files
    const name = entry.path.replace(`${VAULT_DIRS.recipes}/`, "");

    let recipe: Awaited<ReturnType<typeof loadRecipe>>;
    try {
      recipe = await loadRecipe(name);
    } catch (err) {
      // A folder without a valid SKILL.md is not a recipe — skip it.
      if (err instanceof VaultNotFoundError) continue;
      throw err;
    }

    const recipeConfig = config.recipes[name];
    const enabled = recipeConfig?.enabled !== false;
    const model = recipeConfig?.model ?? recipe.meta.model ?? config.defaultModel;
    const [lastRun, runCount] = await Promise.all([readLastRun(name), countRunRecords(name)]);

    items.push({
      name,
      description: recipe.meta.description,
      trigger: recipe.meta.trigger,
      schedule: recipeConfig?.schedule ?? recipe.meta.schedule,
      scheduleOverride: recipeConfig?.schedule,
      enabled,
      model,
      modelOverride: recipeConfig?.model,
      fallbackOverride: recipeConfig?.fallback,
      lastRun,
      runCount,
    });
  }

  return items;
}
