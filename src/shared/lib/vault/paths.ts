/**
 * THE vault path constants file — single source of truth (Chapter 2 Contract).
 *
 * The vault root and EVERY storage path live here. Never hard-code a vault path
 * anywhere else, so a future relocation/rename is a one-line change. Browser-safe
 * (pure strings + slugify; no node:fs — the server resolves these to absolute
 * paths via server/io.ts::resolveVaultPath).
 *
 * Layout = flat type-folders with `area` carried in frontmatter (Contract). The
 * one-home rule is enforced by the frontmatter field, not by physical nesting,
 * so rescheduling/re-homing edits one field instead of moving files.
 */

/** Absolute path to the vault DATA folder (markdown only; never committed). */
export const VAULT_ROOT = "/Users/vishmathpati/Arel Ecosystem/arel-workspace";

/** Top-level vault directories. Containers (area/quest/project/database) use a
 * folder-form leaf so they can hold attachments/subpages; leaves are flat files. */
export const VAULT_DIRS = {
  areas: "areas",
  quests: "quests",
  projects: "projects",
  tasks: "tasks",
  pages: "pages",
  databases: "databases",
  inbox: "inbox",
  recipes: "system/recipes",
  daily: "system/daily",
  weekly: "system/weekly",
  /** Per-software-project dashboard snapshots written by the project-sync recipe (D64). */
  projectSnapshots: "system/project-snapshots",
  archive: "archive/deleted",
  /** Uploaded media (images, video, files) referenced by Plate media nodes. */
  media: "media",
} as const;

/** Single-file vault documents (not under a per-item folder). */
export const VAULT_FILES = {
  idealWeek: "system/ideal-week.md",
} as const;

/**
 * Slugify a title into a filename-safe stem: lowercase, alphanumerics and
 * hyphens only, collapsed and trimmed.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Relative path builders (all return paths relative to VAULT_ROOT) ─────────

/** tasks/<slug>.md */
export const taskPath = (slug: string): string => `${VAULT_DIRS.tasks}/${slug}.md`;

/** projects/<slug>/<slug>.md (folder-form container). */
export const projectPath = (slug: string): string => `${VAULT_DIRS.projects}/${slug}/${slug}.md`;

/** quests/<slug>/<slug>.md (folder-form container). */
export const questPath = (slug: string): string => `${VAULT_DIRS.quests}/${slug}/${slug}.md`;

/** areas/<slug>/_index.md */
export const areaIndexPath = (slug: string): string => `${VAULT_DIRS.areas}/${slug}/_index.md`;

/** pages/<slug>.md — Pages and Resources both live here, split by frontmatter type. */
export const pagePath = (slug: string): string => `${VAULT_DIRS.pages}/${slug}.md`;

/** databases/<slug>/_index.md (config; rows are Pages queried by the engine). */
export const databaseIndexPath = (slug: string): string =>
  `${VAULT_DIRS.databases}/${slug}/_index.md`;

/** inbox/<id>.md where id is a "<timestamp>-<slug>" capture id. */
export const inboxPath = (id: string): string => `${VAULT_DIRS.inbox}/${id}.md`;

/** system/daily/<YYYY-MM-DD>.md */
export const dailyPath = (date: string): string => `${VAULT_DIRS.daily}/${date}.md`;

/** system/weekly/<YYYY-Www>.md */
export const weeklyPath = (week: string): string => `${VAULT_DIRS.weekly}/${week}.md`;

/** system/ideal-week.md */
export const idealWeekPath = (): string => VAULT_FILES.idealWeek;

/** archive/deleted/<original-relative-path> — soft-delete target (D12). */
export const archivedPath = (originalRelativePath: string): string =>
  `${VAULT_DIRS.archive}/${originalRelativePath}`;

/** media/<filename> — uploaded media (referenced by Plate media nodes). */
export const mediaPath = (filename: string): string => `${VAULT_DIRS.media}/${filename}`;

/** system/project-snapshots/<slug>.md — a software project's dashboard snapshot (D64). */
export const projectSnapshotPath = (slug: string): string =>
  `${VAULT_DIRS.projectSnapshots}/${slug}.md`;

// ── Engine recipes (system/recipes) ──────────────────────────────────────────

/** system/recipes/<name>/ — an Engine recipe folder. */
export const recipeDir = (name: string): string => `${VAULT_DIRS.recipes}/${name}`;

/** system/recipes/<name>/SKILL.md — the recipe's task instructions. */
export const recipeSkillPath = (name: string): string => `${recipeDir(name)}/SKILL.md`;

/** system/recipes/<name>/log.md — the recipe's run history. */
export const recipeLogPath = (name: string): string => `${recipeDir(name)}/log.md`;

/** system/recipes/context.md — shared vault glossary injected into every run. */
export const recipesContextPath = (): string => `${VAULT_DIRS.recipes}/context.md`;

/** system/recipes/config.md — the Engine's model-config store (defaults + per-recipe overrides). */
export const recipesConfigPath = (): string => `${VAULT_DIRS.recipes}/config.md`;

/** system/recipes/<name>/runs.jsonl — structured per-run records for the Engine run history UI. */
export const recipeRunsPath = (name: string): string => `${recipeDir(name)}/runs.jsonl`;

/** system/recipes/schedule.md — persisted due-table for the in-process scheduler. */
export const recipesSchedulePath = (): string => `${VAULT_DIRS.recipes}/schedule.md`;
