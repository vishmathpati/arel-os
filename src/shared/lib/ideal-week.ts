/**
 * Ideal Week data layer (Ch14 / D40) — the time-blocking template. One always-
 * present file at `system/ideal-week.md` holding `blocks[]`. Read-or-create on
 * first access (the template always exists once visited). Browser-only; no
 * indexing/caching.
 *
 * v1 ships recurring blocks only (the template repeats every week). The `one-off`
 * kind + `week` scoping (per-week deviations added during the Weekly Review) are a
 * fast-follow — the schema already carries them.
 */

import { readDoc, writeDoc } from "@/shared/lib/vault/client";
import { idealWeekPath } from "@/shared/lib/vault/paths";
import type {
  IdealWeekBlock,
  IdealWeekCategory,
  IdealWeekFrontmatter,
  VaultDoc,
  WeekDay,
} from "@/shared/lib/vault/schemas";

/** The in-memory template: frontmatter (with blocks) + path/body. */
export interface IdealWeek extends IdealWeekFrontmatter {
  path: string;
  body: string;
}

/** What the editor collects to create a block (kind defaults to recurring in v1). */
export interface CreateBlockInput {
  day: WeekDay;
  /** HH:MM. */
  start: string;
  /** HH:MM. */
  end: string;
  label: string;
  category: IdealWeekCategory;
  area?: string;
  /** Optional Quest/Project/Task wikilink. */
  link?: string;
}

// ── Days (Mon–Sun — the Ideal Week is a life template, D40) ──────────────────

export const IDEAL_WEEK_DAYS: readonly WeekDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const DAY_LABEL: Record<WeekDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const DAY_SHORT: Record<WeekDay, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

// ── Categories (label + token names; colors are pre-scaffolded, D40) ─────────

export const CATEGORY_ORDER: readonly IdealWeekCategory[] = [
  "ritual",
  "deep-work",
  "admin",
  "health",
  "social",
  "learning",
  "recharge",
];

export const CATEGORY_LABEL: Record<IdealWeekCategory, string> = {
  ritual: "Ritual",
  "deep-work": "Deep work",
  admin: "Admin",
  health: "Health",
  social: "Social",
  learning: "Learning",
  recharge: "Recharge",
};

/** Block accent — the saturated bar/label tint (`--color-cat-<category>-border`). */
export const categoryAccent = (c: IdealWeekCategory): string => `var(--color-cat-${c}-border)`;
/** Block fill — the `--cat-<category>` surface (mode-aware: deep on dark, pale on light). */
export const categoryFill = (c: IdealWeekCategory): string => `var(--color-cat-${c})`;

// ── Time helpers (HH:MM ↔ minutes; pure + testable) ──────────────────────────

/** "HH:MM" → minutes since midnight. */
export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes since midnight → "HH:MM" (24h, zero-padded). */
export function minutesToTime(min: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, min));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Snap a minute value to the nearest `step` (default 15). */
export function snapMinutes(min: number, step = 15): number {
  return Math.round(min / step) * step;
}

/** "HH:MM" → a 12-hour display label, e.g. "09:00" → "9:00 AM". */
export function formatTimeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 && h < 24 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// ── Grid window (template-level, persisted; default 08:00–23:00) ──────────────

export const DEFAULT_DAY_START = "08:00";
export const DEFAULT_DAY_END = "23:00";

/**
 * The list of selectable times within a window, in `step`-minute increments.
 * Inclusive of both ends so the end-time picker can offer the window close.
 * Each option carries the stored "HH:MM" value + its "9:00 AM" display label.
 */
export function timeOptions(
  startHHMM: string,
  endHHMM: string,
  step = 15,
): { value: string; label: string }[] {
  const start = snapMinutes(timeToMinutes(startHHMM), step);
  const end = snapMinutes(timeToMinutes(endHHMM), step);
  const out: { value: string; label: string }[] = [];
  for (let m = start; m <= end; m += step) {
    const value = minutesToTime(m);
    out.push({ value, label: formatTimeLabel(value) });
  }
  return out;
}

// ── Block id ─────────────────────────────────────────────────────────────────

/** iwb-<base36 time>-<rand> — stable, sortable-ish, collision-safe enough. */
export function newBlockId(): string {
  const t = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `iwb-${t}-${rand}`;
}

// ── Read / mutate ────────────────────────────────────────────────────────────

function toIdealWeek(doc: VaultDoc<IdealWeekFrontmatter>): IdealWeek {
  return { ...doc.frontmatter, path: doc.path, body: doc.body };
}

function frontmatterOf(iw: IdealWeek): Record<string, unknown> {
  const { path: _p, body: _b, ...fm } = iw;
  return fm;
}

/** Read the template, creating it empty on first access. */
export async function readIdealWeek(): Promise<IdealWeek> {
  try {
    const doc = (await readDoc(idealWeekPath())) as VaultDoc<IdealWeekFrontmatter>;
    if (doc.frontmatter?.type === "ideal-week") return toIdealWeek(doc);
  } catch {
    // falls through to create
  }
  const frontmatter: Record<string, unknown> = {
    type: "ideal-week",
    version: 1,
    day_start: DEFAULT_DAY_START,
    day_end: DEFAULT_DAY_END,
    blocks: [],
  };
  const res = await writeDoc(idealWeekPath(), frontmatter, "");
  return toIdealWeek({
    path: res.path,
    frontmatter: res.frontmatter as IdealWeekFrontmatter,
    body: "",
  });
}

async function writeBlocks(iw: IdealWeek, blocks: IdealWeekBlock[]): Promise<IdealWeek> {
  const next: IdealWeek = { ...iw, blocks };
  const res = await writeDoc(next.path, frontmatterOf(next), next.body);
  return toIdealWeek({
    path: next.path,
    frontmatter: res.frontmatter as IdealWeekFrontmatter,
    body: next.body,
  });
}

/** Append a new recurring block (v1 — every block is the weekly template). */
export async function addBlock(iw: IdealWeek, input: CreateBlockInput): Promise<IdealWeek> {
  const block: IdealWeekBlock = {
    id: newBlockId(),
    kind: "recurring",
    day: input.day,
    start: input.start,
    end: input.end,
    label: input.label,
    category: input.category,
    ...(input.area ? { area: input.area as IdealWeekBlock["area"] } : {}),
    ...(input.link ? { link: input.link } : {}),
  };
  return writeBlocks(iw, [...iw.blocks, block]);
}

/** Patch one block by id (dropping keys explicitly set to undefined). */
export async function updateBlock(
  iw: IdealWeek,
  id: string,
  patch: Partial<IdealWeekBlock>,
): Promise<IdealWeek> {
  const blocks = iw.blocks.map((b) => {
    if (b.id !== id) return b;
    const merged = { ...b, ...patch } as IdealWeekBlock;
    for (const key of Object.keys(patch) as (keyof IdealWeekBlock)[]) {
      if (patch[key] === undefined) delete merged[key];
    }
    return merged;
  });
  return writeBlocks(iw, blocks);
}

/** Remove a block by id. */
export async function removeBlock(iw: IdealWeek, id: string): Promise<IdealWeek> {
  return writeBlocks(
    iw,
    iw.blocks.filter((b) => b.id !== id),
  );
}

/** Persist the grid window (template-level). */
export async function setWindow(
  iw: IdealWeek,
  dayStart: string,
  dayEnd: string,
): Promise<IdealWeek> {
  const next: IdealWeek = { ...iw, day_start: dayStart, day_end: dayEnd };
  const res = await writeDoc(next.path, frontmatterOf(next), next.body);
  return toIdealWeek({
    path: next.path,
    frontmatter: res.frontmatter as IdealWeekFrontmatter,
    body: next.body,
  });
}
