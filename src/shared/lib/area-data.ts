/**
 * Area data layer — reads/writes the area `_index.md` files under `areas/`.
 * Browser-only (uses the fetch-based vault client). No indexing/caching: every
 * read hits the files fresh.
 *
 * Top-level Areas are fully user-defined (no more fixed 6 — see areas.ts for
 * the color/icon palette this module assigns on creation). A vault with zero
 * areas is valid; the UI shows an empty state inviting creation (onboarding
 * wizard territory, out of scope here). Sub-areas (2-level max) already
 * worked this way — this just extends the same mechanism up to top-level.
 */

import { iconByName, paletteForOrder } from "@/shared/lib/areas";
import { listDir, readDoc, writeDoc as vaultWriteDoc } from "@/shared/lib/vault/client";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import { areaIndexPath, slugify } from "@/shared/lib/vault/paths";
import type { AreaFrontmatter, VaultDoc } from "@/shared/lib/vault/schemas";
import type { LucideIcon } from "lucide-react";

/** A resolved area: vault frontmatter merged with its resolved identity. */
export interface Area {
  slug: string;
  name: string;
  description: string;
  /** Identity color token ref (`var(--color-area-N)`), resolved from
   * frontmatter.color or (for areas written before this field existed)
   * derived from `order` via the palette. */
  color: string;
  icon: LucideIcon;
  archived: boolean;
  /** Parent slug if this is a sub-area; undefined for top-level. */
  parent?: string;
  order: number;
  /** Vault path of the `_index.md`. */
  path: string;
  /** Markdown body = the Plate editor content (separate from the tagline, D29). */
  body: string;
}

function toArea(doc: VaultDoc<AreaFrontmatter>): Area {
  const fm = doc.frontmatter;
  const slug = wikiTarget(fm.area ?? "") || doc.path.split("/")[1] || "";
  const parent = fm.parent ? wikiTarget(fm.parent) : undefined;
  const order = fm.order ?? 999;
  const palette = paletteForOrder(order);
  return {
    slug,
    name: fm.name ?? slug,
    description: fm.description ?? "",
    color: fm.color ?? palette.color,
    icon: iconByName(fm.icon) ?? palette.icon,
    archived: fm.archived ?? false,
    parent,
    order,
    path: doc.path,
    body: doc.body,
  };
}

/** Read one area's `_index.md`, or null if it doesn't exist. */
export async function readArea(slug: string): Promise<Area | null> {
  try {
    const doc = (await readDoc(areaIndexPath(slug))) as VaultDoc<AreaFrontmatter>;
    if (doc.frontmatter?.type !== "area") return null;
    return toArea(doc);
  } catch {
    return null;
  }
}

/** All areas, sorted by order. Includes sub-areas. Empty vault → empty array. */
export async function listAreas(): Promise<Area[]> {
  const { entries } = await listDir("areas");
  const dirs = entries.filter((e) => e.type === "dir");
  const docs = await Promise.all(dirs.map((e) => readDoc(`${e.path}/_index.md`).catch(() => null)));
  return docs
    .filter((d): d is VaultDoc<AreaFrontmatter> => d?.frontmatter?.type === "area")
    .map(toArea)
    .sort((a, b) => a.order - b.order);
}

/** Direct sub-areas of an area. */
export async function listSubAreas(parentSlug: string): Promise<Area[]> {
  const all = await listAreas();
  return all.filter((a) => a.parent === parentSlug);
}

/** Build a unique slug from a name against the currently-taken area slugs. */
async function uniqueAreaSlug(name: string): Promise<string> {
  const { entries } = await listDir("areas");
  const takenSlugs = new Set(
    entries.filter((e) => e.type === "dir").map((e) => e.path.split("/")[1] ?? ""),
  );
  const base = slugify(name) || "area";
  let slug = base;
  let n = 2;
  while (takenSlugs.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

export interface CreateAreaInput {
  name: string;
  description?: string;
}

/**
 * Create a new top-level area. Assigns the next `order` (after the current
 * max top-level order) and resolves its color/icon from the palette at that
 * order, persisting both into frontmatter so the identity is stable even if
 * later areas are reordered or archived.
 */
export async function createArea(input: CreateAreaInput): Promise<Area> {
  const slug = await uniqueAreaSlug(input.name);
  const topLevel = (await listAreas()).filter((a) => !a.parent);
  const order = topLevel.length > 0 ? Math.max(...topLevel.map((a) => a.order)) + 1 : 1;
  const palette = paletteForOrder(order);

  const frontmatter: Record<string, unknown> = {
    type: "area",
    area: toWikilink(slug),
    name: input.name,
    order,
    archived: false,
    color: palette.color,
    icon: palette.iconName,
  };
  if (input.description) frontmatter.description = input.description;

  const res = await vaultWriteDoc(areaIndexPath(slug), frontmatter, "");
  return toArea({ path: res.path, frontmatter: res.frontmatter as AreaFrontmatter, body: "" });
}

export interface CreateSubAreaInput {
  name: string;
  description?: string;
}

/**
 * Create a sub-area under `parentSlug`. Writes `areas/<slug>/_index.md` with
 * `type: area`, `parent: [[parentSlug]]`, unique slug, and next order value.
 * Sub-areas inherit their parent's color/icon (no independent identity).
 *
 * 2-level max rule: throws if the chosen parent itself already has a `parent`.
 */
export async function createSubArea(parentSlug: string, input: CreateSubAreaInput): Promise<Area> {
  // Enforce 2-level max: the parent must be a top-level area
  const parent = await readArea(parentSlug);
  if (!parent) throw new Error(`Parent area "${parentSlug}" not found.`);
  if (parent.parent) {
    throw new Error(
      `Cannot create a sub-area under "${parent.name}" — it is already a sub-area. Sub-areas are limited to 2 levels.`,
    );
  }

  const slug = await uniqueAreaSlug(input.name);

  // Determine next order value among existing sub-areas of this parent
  const existingSubs = await listSubAreas(parentSlug);
  const order = existingSubs.length > 0 ? Math.max(...existingSubs.map((s) => s.order)) + 1 : 1;

  const frontmatter: Record<string, unknown> = {
    type: "area",
    area: toWikilink(slug),
    name: input.name,
    parent: toWikilink(parentSlug),
    order,
    archived: false,
  };
  if (input.description) frontmatter.description = input.description;

  const res = await vaultWriteDoc(areaIndexPath(slug), frontmatter, "");
  return toArea({ path: res.path, frontmatter: res.frontmatter as AreaFrontmatter, body: "" });
}

/** Patch an area's editable frontmatter (name, description, archived, …). */
export async function updateArea(area: Area, patch: Partial<AreaFrontmatter>): Promise<Area> {
  const doc = (await readDoc(area.path)) as VaultDoc<AreaFrontmatter>;
  const frontmatter = { ...doc.frontmatter, ...patch };
  for (const key of Object.keys(patch) as (keyof AreaFrontmatter)[]) {
    if (patch[key] === undefined) delete frontmatter[key];
  }
  const res = await vaultWriteDoc(area.path, frontmatter, doc.body);
  return toArea({
    path: area.path,
    frontmatter: res.frontmatter as AreaFrontmatter,
    body: doc.body,
  });
}

/** Rename an area (its display name — the slug/path never change). */
export async function renameArea(area: Area, name: string): Promise<Area> {
  return updateArea(area, { name });
}

/** Archive or unarchive an area. Top-level areas are archivable like any
 * other now that they're user-created (no more "fixed, permanent" anchors). */
export async function setAreaArchived(area: Area, archived: boolean): Promise<Area> {
  return updateArea(area, { archived });
}

/** Save an inline-edited one-line description. */
export async function setAreaDescription(area: Area, description: string): Promise<Area> {
  return updateArea(area, { description });
}

/** Save the area's Plate editor body, preserving frontmatter (D29). */
export async function setAreaBody(area: Area, body: string): Promise<Area> {
  const doc = (await readDoc(area.path)) as VaultDoc<AreaFrontmatter>;
  const frontmatter: Record<string, unknown> = { ...doc.frontmatter };
  const res = await vaultWriteDoc(area.path, frontmatter, body);
  return toArea({ path: area.path, frontmatter: res.frontmatter as AreaFrontmatter, body });
}
