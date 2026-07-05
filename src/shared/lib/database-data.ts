/**
 * Database data layer (Chapter 8, D7) — custom databases are FOLDER-backed: a
 * database is the folder `databases/<slug>/`, its config lives in `_index.md`
 * (`type: database`, columns[]), and every other `.md` file in the folder is a
 * row. Each row IS a Page (`type: page`) so it opens in the shared PageBody
 * editor. This is the hybrid model (Contract, Ch8): folders for custom
 * databases, a filter for the Library (resource-data.ts). No general filter
 * engine, no saved query language.
 *
 * Browser-only; reads fresh every call (no indexing). Soft-delete only (D12).
 */

import { type DbRow, toRow } from "@/shared/lib/db-rows";
import { deleteDoc, listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import { VAULT_DIRS, databaseIndexPath, slugify } from "@/shared/lib/vault/paths";
import type { DatabaseColumn, DatabaseFrontmatter, VaultDoc } from "@/shared/lib/vault/schemas";

/** A database's config + identity. */
export interface DatabaseConfig extends DatabaseFrontmatter {
  /** Folder stem, e.g. "subscriptions". */
  slug: string;
  /** Path to the `_index.md` config file. */
  path: string;
}

export interface CreateDatabaseInput {
  name: string;
  area?: string;
  description?: string;
  columns?: DatabaseColumn[];
}

function toConfig(doc: VaultDoc<DatabaseFrontmatter>): DatabaseConfig {
  const slug = doc.path
    .replace(new RegExp(`^${VAULT_DIRS.databases}/`), "")
    .replace(/\/_index\.md$/, "");
  return { ...doc.frontmatter, slug, path: doc.path };
}

/** All databases, optionally narrowed to one area. */
export async function listDatabases(areaSlug?: string): Promise<DatabaseConfig[]> {
  const { entries } = await listDir(VAULT_DIRS.databases);
  const dirs = entries.filter((e) => e.type === "dir");
  const docs = await Promise.all(dirs.map((e) => readDoc(`${e.path}/_index.md`).catch(() => null)));
  return docs
    .filter((d): d is VaultDoc<DatabaseFrontmatter> => d?.frontmatter?.type === "database")
    .filter((d) => !d.frontmatter.deleted)
    .filter((d) => !areaSlug || wikiTarget(String(d.frontmatter.area ?? "")) === areaSlug)
    .map(toConfig);
}

/** Read one database config, or null if missing. */
export async function readDatabase(slug: string): Promise<DatabaseConfig | null> {
  try {
    const doc = (await readDoc(databaseIndexPath(slug))) as VaultDoc<DatabaseFrontmatter>;
    if (doc.frontmatter?.type !== "database" || doc.frontmatter.deleted) return null;
    return toConfig(doc);
  } catch {
    return null;
  }
}

async function takenDbSlugs(): Promise<Set<string>> {
  const { entries } = await listDir(VAULT_DIRS.databases);
  return new Set(
    entries
      .filter((e) => e.type === "dir")
      .map((e) => e.path.replace(new RegExp(`^${VAULT_DIRS.databases}/`), "")),
  );
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "untitled";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/** Create a database (writes `databases/<slug>/_index.md`). */
export async function createDatabase(input: CreateDatabaseInput): Promise<DatabaseConfig> {
  const slug = uniqueSlug(slugify(input.name), await takenDbSlugs());
  const frontmatter: Record<string, unknown> = {
    type: "database",
    name: input.name,
    columns: input.columns ?? [],
  };
  if (input.area) frontmatter.area = toWikilink(input.area);
  if (input.description) frontmatter.description = input.description;

  const path = databaseIndexPath(slug);
  const res = await writeDoc(path, frontmatter, "");
  return toConfig({ path, frontmatter: res.frontmatter as DatabaseFrontmatter, body: "" });
}

/** Patch a database's config (name / description / columns). */
export async function updateDatabase(
  config: DatabaseConfig,
  patch: Partial<
    Pick<DatabaseFrontmatter, "name" | "description" | "columns" | "area" | "full_width">
  >,
): Promise<DatabaseConfig> {
  const { slug: _s, path, ...fm } = config;
  const frontmatter = { ...fm, ...patch };
  const res = await writeDoc(path, frontmatter, "");
  return toConfig({ path, frontmatter: res.frontmatter as DatabaseFrontmatter, body: "" });
}

/** Soft-delete a database (archives its `_index.md`; rows remain on disk). */
export async function deleteDatabase(config: DatabaseConfig): Promise<void> {
  await deleteDoc(config.path);
}

// ── Rows (folder files, excluding _index.md) ─────────────────────────────────

/** All rows of a database (every `.md` in its folder except `_index.md`). */
export async function listRows(slug: string): Promise<DbRow[]> {
  const { entries } = await listDir(`${VAULT_DIRS.databases}/${slug}`);
  const files = entries.filter(
    (e) => e.type === "file" && e.path.endsWith(".md") && !e.path.endsWith("/_index.md"),
  );
  const docs = await Promise.all(files.map((e) => readDoc(e.path).catch(() => null)));
  return docs
    .filter((d): d is VaultDoc => d != null && !d.frontmatter?.deleted)
    .map((d) => toRow(d.path, d.frontmatter as unknown as Record<string, unknown>, d.body));
}

/** Create a row (a `type: page` file in the database folder). */
export async function createRow(slug: string, title: string): Promise<DbRow> {
  const existing = await listRows(slug);
  const taken = new Set(existing.map((r) => r.slug));
  const rowSlug = uniqueSlug(slugify(title) || "untitled", taken);
  const path = `${VAULT_DIRS.databases}/${slug}/${rowSlug}.md`;
  const frontmatter: Record<string, unknown> = {
    type: "page",
    title,
    database: toWikilink(slug),
  };
  const res = await writeDoc(path, frontmatter, "");
  return toRow(path, res.frontmatter as unknown as Record<string, unknown>, "");
}
