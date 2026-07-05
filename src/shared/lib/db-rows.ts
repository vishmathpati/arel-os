/**
 * Database rows (Chapter 8, D7) — generic row I/O shared by Library resources
 * (`pages/<slug>.md`, `type: resource`) and custom-database rows
 * (`databases/<db>/<row>.md`, `type: page`). A row is just a vault file, so
 * cell/body edits, opening, and deletion are identical regardless of source;
 * only *creation* and *listing* differ (those live in resource-data /
 * database-data). Each row opens as a full Page via the shared PageBody editor.
 *
 * Browser-only; reads fresh every call (no indexing). Soft-delete only (D12).
 */

import { deleteDoc, readDoc, writeDoc } from "@/shared/lib/vault/client";

/**
 * The in-memory shape every Database view consumes. `frontmatter` carries the
 * column values; `title` is the special row-title column; `body` is the Plate
 * markdown (preserved verbatim across cell edits).
 */
export interface DbRow {
  /** Vault-relative path of the row file. */
  path: string;
  /** Filename stem (last path segment, no `.md`). */
  slug: string;
  /** Display title — `frontmatter.title` or the slug. */
  title: string;
  /** All frontmatter, for column rendering / cell editing. */
  frontmatter: Record<string, unknown>;
  /** Markdown body = the row's Page editor content. */
  body: string;
}

/** Build a DbRow from a raw read. */
export function toRow(path: string, frontmatter: Record<string, unknown>, body: string): DbRow {
  const slug = path.split("/").pop()?.replace(/\.md$/, "") ?? path;
  const title =
    typeof frontmatter.title === "string" && frontmatter.title.trim()
      ? (frontmatter.title as string)
      : slug;
  return { path, slug, title, frontmatter, body };
}

/** Load one row by vault path, or null if missing. */
export async function loadRow(path: string): Promise<DbRow | null> {
  try {
    const doc = await readDoc(path);
    if (doc.frontmatter?.deleted) return null;
    return toRow(doc.path, doc.frontmatter as unknown as Record<string, unknown>, doc.body);
  } catch {
    return null;
  }
}

/** Write a single column value back to a row's frontmatter (body preserved). */
export async function setRowCell(row: DbRow, key: string, value: unknown): Promise<DbRow> {
  const frontmatter = { ...row.frontmatter };
  if (value === undefined || value === "" || value === null) delete frontmatter[key];
  else frontmatter[key] = value;
  const res = await writeDoc(row.path, frontmatter, row.body);
  return toRow(row.path, res.frontmatter as unknown as Record<string, unknown>, row.body);
}

/** Patch several frontmatter keys at once (e.g. title + icon). */
export async function setRowFrontmatter(
  row: DbRow,
  patch: Record<string, unknown>,
): Promise<DbRow> {
  const frontmatter = { ...row.frontmatter, ...patch };
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete frontmatter[k];
  const res = await writeDoc(row.path, frontmatter, row.body);
  return toRow(row.path, res.frontmatter as unknown as Record<string, unknown>, row.body);
}

/** Persist the row's markdown body (the Plate editor content). */
export async function setRowBody(row: DbRow, body: string): Promise<DbRow> {
  const res = await writeDoc(row.path, row.frontmatter, body);
  return toRow(row.path, res.frontmatter as unknown as Record<string, unknown>, body);
}

/** Soft-delete a row (moves it to archive/deleted/). */
export async function deleteRow(row: DbRow): Promise<void> {
  await deleteDoc(row.path);
}
