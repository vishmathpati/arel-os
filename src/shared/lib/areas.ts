/**
 * The 6 locked top-level Areas (BRIEF D1). Single shared source for slug↔label
 * so the sidebar, router, and pickers agree. Area is stored on items as a
 * `[[slug]]` wikilink.
 */

import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { AreaSlug } from "@/shared/lib/vault/schemas";
import {
  Briefcase,
  GraduationCap,
  HeartPulse,
  type LucideIcon,
  Sparkles,
  Video,
  Wallet,
} from "lucide-react";

export interface AreaOption {
  slug: AreaSlug;
  label: string;
  /** Identity color as a DESIGN.md token reference (D26). Used in inline
   * `style={{ backgroundColor }}` for the quiet area dot — slugs are dynamic,
   * so a CSS var beats a Tailwind class that the static scan can't see. */
  color: string;
  /** Identity icon (single source — sidebar, router, area page all read this). */
  icon: LucideIcon;
}

export const AREA_OPTIONS: readonly AreaOption[] = [
  { slug: "health", label: "Health", color: "var(--color-area-health)", icon: HeartPulse },
  { slug: "finance", label: "Finance", color: "var(--color-area-finance)", icon: Wallet },
  { slug: "learning", label: "Learning", color: "var(--color-area-learning)", icon: GraduationCap },
  {
    slug: "spirituality",
    label: "Spirituality",
    color: "var(--color-area-spirituality)",
    icon: Sparkles,
  },
  { slug: "youtube", label: "YouTube", color: "var(--color-area-youtube)", icon: Video },
  { slug: "business", label: "Business", color: "var(--color-area-business)", icon: Briefcase },
];

const LABEL_BY_SLUG = new Map(AREA_OPTIONS.map((a) => [a.slug, a.label]));
const COLOR_BY_SLUG = new Map(AREA_OPTIONS.map((a) => [a.slug, a.color]));
const ICON_BY_SLUG = new Map(AREA_OPTIONS.map((a) => [a.slug, a.icon]));
const OPTION_BY_SLUG = new Map(AREA_OPTIONS.map((a) => [a.slug, a]));

/** Identity icon for a slug or stored wikilink, or null if unknown. */
export function areaIcon(area: string | undefined): LucideIcon | null {
  if (!area) return null;
  return ICON_BY_SLUG.get(wikiTarget(area) as AreaSlug) ?? null;
}

/** The full identity option for a slug or stored wikilink, or null. */
export function areaOption(area: string | undefined): AreaOption | null {
  if (!area) return null;
  return OPTION_BY_SLUG.get(wikiTarget(area) as AreaSlug) ?? null;
}

/** Human label for a stored area wikilink ("[[health]]" → "Health"). */
export function areaLabel(area: string | undefined): string | null {
  if (!area) return null;
  const slug = wikiTarget(area);
  return LABEL_BY_SLUG.get(slug as AreaSlug) ?? slug;
}

/** The bare slug from a stored area wikilink ("[[health]]" → "health"). */
export function areaSlug(area: string | undefined): string | null {
  return area ? wikiTarget(area) : null;
}

/** Identity color for a stored area wikilink, or null if unknown/unhomed. */
export function areaColor(area: string | undefined): string | null {
  if (!area) return null;
  return COLOR_BY_SLUG.get(wikiTarget(area) as AreaSlug) ?? null;
}

/** Wrap a slug into the stored wikilink form ("health" → "[[health]]"). */
export function areaWikilink(slug: string): string {
  return toWikilink(slug);
}
