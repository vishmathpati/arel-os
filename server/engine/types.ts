/**
 * Engine types — the shape of a Recipe and a run's outcome.
 *
 * A Recipe is a unit the Engine runs: a SKILL.md (instructions + frontmatter)
 * plus the shared vault glossary (context.md). The Engine reads these, runs the
 * AI-SDK tool-use loop, writes results into the vault, and appends one RunOutcome
 * line to the recipe's log.md.
 */

/** Parsed frontmatter of a recipe's SKILL.md. */
export interface RecipeMeta {
  /** Recipe name (defaults to the folder name). */
  name: string;
  /** One-line description of what the recipe does. */
  description?: string;
  /** Per-recipe model override (Gateway slug, e.g. "deepseek/deepseek-v4"). Falls back to ARELOS_ENGINE_MODEL. */
  model?: string;
  /** Ordered fallback model slugs. Falls back to ARELOS_ENGINE_FALLBACK. */
  fallback: string[];
  /** Tool names this recipe may use (from the Engine tool registry). */
  allowedTools: string[];
  /** "on-demand" | "manual" | "scheduled" | a schedule string. */
  trigger: string;
  /** Optional explicit schedule (e.g. cron "0 10,22 * * *") when `trigger` is "scheduled". */
  schedule?: string;
}

/** A loaded recipe, ready to run. */
export interface Recipe {
  name: string;
  meta: RecipeMeta;
  /** The SKILL.md body — the task instructions. */
  body: string;
  /** The shared context.md body (vault glossary); "" if absent. */
  context: string;
}

/** A single vault file write captured during a run (what the run changed). */
export interface VaultChange {
  op: "created" | "updated";
  /** Internal vault path — kept for debugging/logs, never shown in the UI. */
  path: string;
  /** Human label (the written file's `title`), e.g. "Surfshark" or "Netflix". */
  label?: string;
  /** Human noun for what was written: "transaction" | "subscription" | "card" | "bank account" | "summary" | "log" | … */
  kind?: string;
  /** Human money value pulled from the frontmatter, e.g. "₹279" or "₹32,390 outstanding". */
  amount?: string;
}

/** The result of one run — one line in log.md, and what the caller gets back. */
export interface RunOutcome {
  status: "ok" | "failed";
  trigger: string;
  model: string;
  durationMs: number;
  totalTokens: number;
  /** Input tokens served from the prompt cache (gateway caching). 0 if none/uncached. */
  cachedTokens?: number;
  /** Short result summary (ok) or error message (failed). */
  summary: string;
  /** Full model output text (ok runs only). */
  text?: string;
  /** Vault files written during the run (created or updated). */
  changes?: VaultChange[];
}
