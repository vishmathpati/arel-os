/**
 * Area data layer — reads/writes the area `_index.md` files under `areas/`.
 * Browser-only (uses the fetch-based vault client). No indexing/caching: every
 * read hits the files fresh.
 *
 * Identity for the 6 locked top-level areas (label / color / icon) lives in
 * `areas.ts` — the single source. The vault `_index.md` carries only the
 * MUTABLE state (description, archived, order) plus any user-created sub-areas
 * (which have no `areas.ts` entry and inherit their parent's color). The 6
 * top-level areas are seeded lazily on first load (D26) and are NOT archivable
 * (permanent anchors of the one-home rule).
 */

import { AREA_OPTIONS, areaOption } from "@/shared/lib/areas";
import { listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import { areaIndexPath, slugify } from "@/shared/lib/vault/paths";
import type { AreaFrontmatter, VaultDoc } from "@/shared/lib/vault/schemas";

/** A resolved area: vault state merged with identity (for the fixed 6). */
export interface Area {
  slug: string;
  name: string;
  description: string;
  /** Identity color token ref (`var(--color-area-…)`), or null for unknown. */
  color: string | null;
  archived: boolean;
  /** Parent slug if this is a sub-area; undefined for top-level. */
  parent?: string;
  order: number;
  /** Vault path of the `_index.md`. */
  path: string;
  /** True for the 6 locked top-level areas — permanent, not archivable. */
  fixed: boolean;
  /** Markdown body = the Plate editor content (separate from the tagline, D29). */
  body: string;
}

/** One-line descriptions for the seeded top-level areas (D26 fork 6). */
const SEED_DESCRIPTIONS: Record<string, string> = {
  health: "Body and mind — fitness, food, sleep, energy.",
  finance: "Money in, money out — saving, spending, growing it.",
  learning: "Skills and knowledge you're actively building.",
  spirituality: "Inner practice — meditation, reflection, meaning.",
  youtube: "The channel — videos, growth, the creator craft.",
  business: "Ventures and work that earn — products, clients, projects.",
};

function toArea(doc: VaultDoc<AreaFrontmatter>): Area {
  const fm = doc.frontmatter;
  const slug = wikiTarget(fm.area ?? "") || doc.path.split("/")[1] || "";
  const identity = areaOption(slug);
  const parent = fm.parent ? wikiTarget(fm.parent) : undefined;
  return {
    slug,
    name: fm.name ?? identity?.label ?? slug,
    description: fm.description ?? "",
    color: identity?.color ?? null,
    archived: fm.archived ?? false,
    parent,
    order: fm.order ?? 999,
    path: doc.path,
    fixed: !!identity && !parent,
    body: doc.body,
  };
}

/**
 * Lazily seed any missing top-level area `_index.md` files. Idempotent — only
 * writes the ones that don't yet exist, so existing (and user-edited) files are
 * never clobbered.
 */
export async function ensureAreasSeeded(): Promise<void> {
  const { entries } = await listDir("areas");
  const present = new Set(entries.filter((e) => e.type === "dir").map((e) => e.path.split("/")[1]));
  await Promise.all(
    AREA_OPTIONS.filter((a) => !present.has(a.slug)).map((a) =>
      writeDoc(
        areaIndexPath(a.slug),
        {
          type: "area",
          area: toWikilink(a.slug),
          name: a.label,
          description: SEED_DESCRIPTIONS[a.slug] ?? "",
          order: AREA_OPTIONS.findIndex((o) => o.slug === a.slug) + 1,
          archived: false,
        },
        "",
      ),
    ),
  );
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

/** All areas (seeded first), sorted by order. Includes sub-areas. */
export async function listAreas(): Promise<Area[]> {
  await ensureAreasSeeded();
  const { entries } = await listDir("areas");
  const dirs = entries.filter((e) => e.type === "dir");
  const docs = await Promise.all(dirs.map((e) => readDoc(`${e.path}/_index.md`).catch(() => null)));
  return docs
    .filter((d): d is VaultDoc<AreaFrontmatter> => d?.frontmatter?.type === "area")
    .map(toArea)
    .sort((a, b) => a.order - b.order);
}

/** Direct sub-areas of an area (display-only for now — creation is deferred). */
export async function listSubAreas(parentSlug: string): Promise<Area[]> {
  const all = await listAreas();
  return all.filter((a) => a.parent === parentSlug);
}

export interface CreateSubAreaInput {
  name: string;
  description?: string;
}

/**
 * Create a sub-area under `parentSlug`. Writes `areas/<slug>/_index.md` with
 * `type: area`, `parent: [[parentSlug]]`, unique slug, and next order value.
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

  // Build a unique slug from the name
  const { entries } = await listDir("areas");
  const takenSlugs = new Set(
    entries.filter((e) => e.type === "dir").map((e) => e.path.split("/")[1] ?? ""),
  );
  const base = slugify(input.name) || "sub-area";
  let slug = base;
  let n = 2;
  while (takenSlugs.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }

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

  const res = await writeDoc(areaIndexPath(slug), frontmatter, "");
  return toArea({ path: res.path, frontmatter: res.frontmatter as AreaFrontmatter, body: "" });
}

/** Patch an area's editable frontmatter (description, archived, …). */
export async function updateArea(area: Area, patch: Partial<AreaFrontmatter>): Promise<Area> {
  const doc = (await readDoc(area.path)) as VaultDoc<AreaFrontmatter>;
  const frontmatter = { ...doc.frontmatter, ...patch };
  for (const key of Object.keys(patch) as (keyof AreaFrontmatter)[]) {
    if (patch[key] === undefined) delete frontmatter[key];
  }
  const res = await writeDoc(area.path, frontmatter, doc.body);
  return toArea({
    path: area.path,
    frontmatter: res.frontmatter as AreaFrontmatter,
    body: doc.body,
  });
}

/** Save an inline-edited one-line description. */
export async function setAreaDescription(area: Area, description: string): Promise<Area> {
  return updateArea(area, { description });
}

/** Save the area's Plate editor body, preserving frontmatter (D29). */
export async function setAreaBody(area: Area, body: string): Promise<Area> {
  const doc = (await readDoc(area.path)) as VaultDoc<AreaFrontmatter>;
  const frontmatter: Record<string, unknown> = { ...doc.frontmatter };
  const res = await writeDoc(area.path, frontmatter, body);
  return toArea({ path: area.path, frontmatter: res.frontmatter as AreaFrontmatter, body });
}
