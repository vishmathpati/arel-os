/**
 * Engine model-config store — persisted as system/recipes/config.md (YAML
 * frontmatter + a one-line body comment). It holds the default/fallback models,
 * the catalog of selectable models, and per-recipe overrides (model + enabled).
 *
 * The Engine consults this at run time so the model is data, not code: a recipe's
 * config override beats its SKILL.md `model`, which beats the global default, which
 * beats the env var. Reads/writes go through the vault I/O layer (atomic writes),
 * so config.md is just another vault document — frontmatter treated as a record.
 */

import { recipesConfigPath } from "../../src/shared/lib/vault/paths.ts";
import { VaultNotFoundError, readVaultFile, writeVaultFile } from "../io.ts";

/** Per-recipe overrides keyed by recipe name. */
export interface RecipeConfig {
  /** Model slug override (absent = use the global default model). */
  model?: string;
  /** Fallback model slug override (absent = use the global fallback model). */
  fallback?: string;
  /** When false, the Engine refuses to run this recipe. Defaults to true. */
  enabled?: boolean;
  /** Schedule override, e.g. "0 10,22 * * *" (absent = use the recipe's SKILL.md schedule). */
  schedule?: string;
}

/** The Engine's model configuration. */
export interface EngineConfig {
  /** Default model slug used when nothing more specific is set. */
  defaultModel: string;
  /** Fallback model slug used when the resolved model errors. */
  fallbackModel: string;
  /** The catalog of selectable model slugs (for the config UI). */
  models: string[];
  /** Per-recipe overrides, keyed by recipe name. */
  recipes: Record<string, RecipeConfig>;
}

/** Seeded defaults written on first access when config.md is absent. */
function seededConfig(): EngineConfig {
  return {
    defaultModel: "deepseek/deepseek-v4-flash",
    fallbackModel: "openai/gpt-5.4-mini",
    models: [
      "anthropic/claude-sonnet-4.6",
      "anthropic/claude-haiku-4.5",
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "moonshotai/kimi-k2.6",
      "openai/gpt-5.4-mini",
      "openai/gpt-5.4",
    ],
    recipes: {},
  };
}

/** Coerce a parsed frontmatter record into a well-formed EngineConfig (defensive). */
function coerce(fm: Record<string, unknown>): EngineConfig {
  const base = seededConfig();
  const defaultModel =
    typeof fm.defaultModel === "string" && fm.defaultModel.trim()
      ? fm.defaultModel.trim()
      : base.defaultModel;
  const fallbackModel =
    typeof fm.fallbackModel === "string" && fm.fallbackModel.trim()
      ? fm.fallbackModel.trim()
      : base.fallbackModel;
  const models = Array.isArray(fm.models)
    ? fm.models.map((m) => String(m).trim()).filter(Boolean)
    : base.models;

  const recipes: Record<string, RecipeConfig> = {};
  if (fm.recipes && typeof fm.recipes === "object" && !Array.isArray(fm.recipes)) {
    for (const [name, value] of Object.entries(fm.recipes as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const entry = value as Record<string, unknown>;
      const cfg: RecipeConfig = {};
      if (typeof entry.model === "string" && entry.model.trim()) cfg.model = entry.model.trim();
      if (typeof entry.fallback === "string" && entry.fallback.trim())
        cfg.fallback = entry.fallback.trim();
      if (typeof entry.enabled === "boolean") cfg.enabled = entry.enabled;
      if (typeof entry.schedule === "string" && entry.schedule.trim())
        cfg.schedule = entry.schedule.trim();
      recipes[name] = cfg;
    }
  }

  return { defaultModel, fallbackModel, models, recipes };
}

/**
 * Read the Engine config from system/recipes/config.md. Returns seeded defaults
 * (without writing) when the file is absent, so a fresh vault Just Works.
 */
export async function readEngineConfig(): Promise<EngineConfig> {
  try {
    const doc = await readVaultFile(recipesConfigPath());
    return coerce(doc.frontmatter as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof VaultNotFoundError) return seededConfig();
    throw err;
  }
}

/**
 * Merge a partial config into the current config and persist it atomically.
 * Top-level scalars/arrays replace; the `recipes` map is shallow-merged per name
 * (so updating one recipe's override leaves the others intact). Returns the new
 * full config.
 */
export async function writeEngineConfig(partial: Partial<EngineConfig>): Promise<EngineConfig> {
  const current = await readEngineConfig();
  const merged: EngineConfig = {
    defaultModel: partial.defaultModel?.trim() || current.defaultModel,
    fallbackModel: partial.fallbackModel?.trim() || current.fallbackModel,
    models: Array.isArray(partial.models) ? partial.models : current.models,
    recipes: { ...current.recipes },
  };
  if (partial.recipes && typeof partial.recipes === "object") {
    for (const [name, cfg] of Object.entries(partial.recipes)) {
      const existing: RecipeConfig = { ...merged.recipes[name] };
      for (const [k, v] of Object.entries(cfg as Record<string, unknown>)) {
        // An empty string clears a string override → fall back to the global/recipe default.
        if ((k === "model" || k === "fallback" || k === "schedule") && v === "") {
          delete existing[k as "model" | "fallback" | "schedule"];
        } else if (v !== undefined) {
          (existing as Record<string, unknown>)[k] = v;
        }
      }
      merged.recipes[name] = existing;
    }
  }

  const body = "<!-- Engine model config — edited via the recipes UI; safe to hand-edit. -->";
  await writeVaultFile(recipesConfigPath(), merged as unknown as Record<string, unknown>, body);
  return merged;
}
