/**
 * Database query helpers (Chapter 8, D7) — PURE transforms over rows. No I/O.
 *
 * The Database primitive is a thin layer over markdown frontmatter: a "row" is
 * a vault file, "columns" are frontmatter keys. This module is the minimal
 * read/sort/group kernel ported from the old app's `bases/resolve.ts` — only
 * the pieces Ch8 actually needs. No general filter-expression engine: filters
 * (Library = `type:resource`, project/quest views) are applied at the data
 * layer in code, not via a stored query language (Contract, Ch8).
 */

import type { DbRow } from "./db-rows";

/** Group key used for rows whose group field is empty. Sorts last. */
export const GROUP_NONE = "__none__";

/** Read a column value off a row. `title` is the special row-title column. */
export function readCell(row: DbRow, key: string): unknown {
  if (key === "title") return row.title;
  return row.frontmatter[key];
}

/** Numeric/date-aware comparison; empties sort to the end. */
function compareLoose(a: unknown, b: unknown): number {
  const aEmpty = a == null || a === "";
  const bEmpty = b == null || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const an = numOrIso(a);
  const bn = numOrIso(b);
  if (an != null && bn != null) return an - bn;
  return String(a).localeCompare(String(b));
}

function numOrIso(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n) && v.trim() !== "") return n;
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

/** Stable multi-row sort by one column. */
export function sortRows(rows: DbRow[], key: string, dir: "asc" | "desc" = "asc"): DbRow[] {
  return [...rows].sort((a, b) => {
    const cmp = compareLoose(readCell(a, key), readCell(b, key));
    return dir === "desc" ? -cmp : cmp;
  });
}

export interface GroupedRows {
  /** group-key → rows */
  groups: Map<string, DbRow[]>;
  /** group keys in display order (GROUP_NONE last) */
  order: string[];
}

/** Group rows by a column's value (stringified). Empty → GROUP_NONE bucket. */
export function groupRows(rows: DbRow[], key: string): GroupedRows {
  const groups = new Map<string, DbRow[]>();
  for (const r of rows) {
    const v = readCell(r, key);
    const k = v == null || v === "" ? GROUP_NONE : String(v);
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }
  const order = [...groups.keys()].sort((a, b) => {
    if (a === GROUP_NONE) return 1;
    if (b === GROUP_NONE) return -1;
    return a.localeCompare(b);
  });
  return { groups, order };
}
