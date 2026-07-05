/**
 * Option colors (Ch8) — the Notion-style colored chips for select / multi-select
 * / status columns. Each option gets a color from a fixed 9-name palette; the
 * mapping is stored per column in `option_colors` and rendered through the
 * `--color-tag-<name>` CSS vars (see DESIGN.md). Pure — no I/O, no React.
 */

import type { DatabaseColumn } from "@/shared/lib/vault/schemas";
import type { CSSProperties } from "react";

export const TAG_COLORS = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const;
export type TagColor = (typeof TAG_COLORS)[number];

/** The full named palette for the option color menu (Notion-style), incl Default. */
export const PICKER_COLORS: { name: string; label: string }[] = [
  { name: "default", label: "Default" },
  { name: "gray", label: "Gray" },
  { name: "brown", label: "Brown" },
  { name: "orange", label: "Orange" },
  { name: "yellow", label: "Yellow" },
  { name: "green", label: "Green" },
  { name: "blue", label: "Blue" },
  { name: "purple", label: "Purple" },
  { name: "pink", label: "Pink" },
  { name: "red", label: "Red" },
];

/** Stable hash → palette index, so an un-mapped option still gets a steady color. */
function hashColor(value: string): TagColor {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return TAG_COLORS[h % TAG_COLORS.length];
}

/** The color name for an option: explicit mapping, else a stable hash fallback. */
export function optionColor(column: DatabaseColumn, option: string): TagColor {
  const explicit = column.option_colors?.[option];
  if (explicit && (TAG_COLORS as readonly string[]).includes(explicit)) return explicit as TagColor;
  return hashColor(option);
}

/** Inline style for an option chip (background + readable foreground). The raw
 * `--tag-*` custom properties are referenced directly (a dynamic color name
 * can't be a static Tailwind class, and the raw vars resolve in both modes). */
export function chipStyle(color: string): CSSProperties {
  return {
    backgroundColor: `var(--tag-${color})`,
    color: `var(--tag-${color}-fg)`,
  };
}

/** Just the chip background var — for color swatches in the option editor. */
export function swatchVar(color: string): string {
  return `var(--tag-${color})`;
}

/** Pick the next palette color for a freshly-created option (cycles by count). */
export function nextColor(usedCount: number): TagColor {
  return TAG_COLORS[usedCount % TAG_COLORS.length];
}

/** Flatten a column's options (select/multi from `options`, status from groups). */
export function columnOptions(column: DatabaseColumn): string[] {
  if (column.type === "status") return (column.groups ?? []).flatMap((g) => g.options);
  return column.options ?? [];
}

/**
 * Add a new option to a select/multi-select column, assigning it the next color.
 * Returns the column patch (options + option_colors) to persist. Status columns
 * add the option to their first group.
 */
export function addOption(column: DatabaseColumn, name: string): Partial<DatabaseColumn> {
  const colors = { ...(column.option_colors ?? {}) };
  if (!colors[name]) colors[name] = nextColor(Object.keys(colors).length);

  if (column.type === "status") {
    const groups = (column.groups ?? []).map((g, i) =>
      i === 0 ? { ...g, options: [...g.options, name] } : g,
    );
    return { groups, option_colors: colors };
  }
  const options = column.options?.includes(name)
    ? column.options
    : [...(column.options ?? []), name];
  return { options, option_colors: colors };
}
