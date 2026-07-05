/**
 * Area identity palette — top-level Areas are user-defined (read from the
 * vault, see area-data.ts), so identity (color/icon) can no longer be a fixed
 * per-slug table. Instead this module owns a small fixed PALETTE, cycled by
 * an area's `order` (1-indexed) so each area gets a stable, distinct look.
 * The resolved color/icon are persisted into the area's `_index.md`
 * frontmatter on creation (AreaFrontmatter.color / .icon) so they survive
 * reordering — this module is only consulted to resolve a fresh assignment
 * or to fall back for areas written before this existed.
 */

import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import {
  Briefcase,
  Compass,
  GraduationCap,
  HeartPulse,
  Layers,
  type LucideIcon,
  Sparkles,
  Wallet,
} from "lucide-react";

export interface PaletteEntry {
  /** DESIGN.md color token reference (`var(--color-area-N)`). */
  color: string;
  /** Lucide icon name, as stored in AreaFrontmatter.icon. */
  iconName: string;
  icon: LucideIcon;
}

/** 6 quiet, mode-independent hues + a generic icon per slot. Cycles for the
 * 7th+ area (color repeats; icon repeats too — good enough at small N). */
export const PALETTE: readonly PaletteEntry[] = [
  { color: "var(--color-area-1)", iconName: "HeartPulse", icon: HeartPulse },
  { color: "var(--color-area-2)", iconName: "Briefcase", icon: Briefcase },
  { color: "var(--color-area-3)", iconName: "GraduationCap", icon: GraduationCap },
  { color: "var(--color-area-4)", iconName: "Sparkles", icon: Sparkles },
  { color: "var(--color-area-5)", iconName: "Compass", icon: Compass },
  { color: "var(--color-area-6)", iconName: "Wallet", icon: Wallet },
];

const ICON_BY_NAME = new Map<string, LucideIcon>(PALETTE.map((p) => [p.iconName, p.icon]));

/** Fallback icon for areas with no resolvable icon (missing/unknown name). */
export const FALLBACK_AREA_ICON: LucideIcon = Layers;

/** Resolve the palette slot for a 1-indexed `order` (cycles past 6). */
export function paletteForOrder(order: number): PaletteEntry {
  const i = (((Math.max(1, order) - 1) % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[i] ?? PALETTE[0];
}

/** Resolve a stored icon name to its component, or the fallback. */
export function iconByName(name: string | undefined): LucideIcon {
  if (!name) return FALLBACK_AREA_ICON;
  return ICON_BY_NAME.get(name) ?? FALLBACK_AREA_ICON;
}

/** The bare slug from a stored area wikilink ("[[health]]" → "health"). */
export function areaSlug(area: string | undefined): string | null {
  return area ? wikiTarget(area) : null;
}

/** Wrap a slug into the stored wikilink form ("health" → "[[health]]"). */
export function areaWikilink(slug: string): string {
  return toWikilink(slug);
}
