/**
 * Relation resolver — pure data-layer logic for resolving a relation column's
 * options and stored wikilink labels. Browser-safe (no fs). The Engine can
 * reuse this by swapping the import targets; no global state.
 *
 * Targets:
 *   undefined       → legacy combined areas + pages (backward-compat)
 *   "areas"         → built-in Areas set only
 *   "pages"         → Pages set only
 *   any other slug  → rows of that database
 */

import { listAreas } from "@/shared/lib/area-data";
import { listRows } from "@/shared/lib/database-data";
import { listPages } from "@/shared/lib/page-data";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";

export interface RelationOption {
  slug: string;
  label: string;
  color?: string;
}

/** Enumerate the choosable options for a relation column target. */
export async function relationOptions(target: string | undefined): Promise<RelationOption[]> {
  if (target === "areas") {
    const areas = await listAreas();
    return areas
      .filter((a) => !a.parent)
      .map((a) => ({ slug: a.slug, label: a.name, color: a.color }));
  }
  if (target === "pages") {
    const pages = await listPages();
    return pages.map((p) => ({ slug: p.slug, label: p.title || p.slug }));
  }
  if (!target) {
    // Legacy: combined areas + pages
    const areas = await listAreas();
    const areaOpts = areas
      .filter((a) => !a.parent)
      .map((a) => ({ slug: a.slug, label: a.name, color: a.color }));
    const pages = await listPages();
    const pageOpts = pages.map((p) => ({ slug: p.slug, label: p.title || p.slug }));
    return [...areaOpts, ...pageOpts];
  }
  // Database slug
  try {
    const rows = await listRows(target);
    return rows.map((r) => ({ slug: r.slug, label: r.title || r.slug }));
  } catch {
    return [];
  }
}

/**
 * Resolve a stored wikilink to its display label + optional color for a given
 * relation target. Never throws — falls back to the raw slug on any error or
 * when the target/row is missing.
 */
export async function relationLabel(
  target: string | undefined,
  wikilink: string,
): Promise<{ label: string; color?: string }> {
  const slug = wikiTarget(wikilink);
  if (!slug) return { label: wikilink };

  if (target === "areas") {
    const areas = await listAreas();
    const area = areas.find((a) => a.slug === slug);
    return area ? { label: area.name, color: area.color } : { label: slug };
  }

  if (!target) {
    // Legacy: try areas first, then pages
    const areas = await listAreas();
    const area = areas.find((a) => a.slug === slug);
    if (area) return { label: area.name, color: area.color };
    try {
      const pages = await listPages();
      const page = pages.find((p) => p.slug === slug);
      if (page) return { label: page.title || slug };
    } catch {
      /* fall through */
    }
    return { label: slug };
  }

  if (target === "pages") {
    try {
      const pages = await listPages();
      const page = pages.find((p) => p.slug === slug);
      if (page) return { label: page.title || slug };
    } catch {
      /* fall through */
    }
    return { label: slug };
  }

  // Database target
  try {
    const rows = await listRows(target);
    const row = rows.find((r) => r.slug === slug);
    return { label: row?.title || slug };
  } catch {
    return { label: slug };
  }
}
