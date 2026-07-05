/**
 * Weekly-note data layer (Ch13 / D39) — read-or-create + save over the Chapter 2
 * vault client. One markdown file per ISO week at `system/weekly/<YYYY-Www>.md`.
 * Browser-only (the client uses fetch). No indexing/caching.
 *
 * The note stores the Weekly Review's own artifacts: Reflect (wins, learnings,
 * focus-quest recap is live), Plan (focus_quests snapshot, recurring[]), and a
 * per-phase `progress` marker. The Maintain phase acts on the vault directly
 * (projects/quests/tasks), so it stores nothing here. Per-day work assignments
 * are NOT stored here either — they are the tasks' own `schedule` dates (D39 Q1),
 * which flow into the Morning Today board for free.
 *
 * The Sunday review targets the COMING week (D39): on any day Tue–Sun the target
 * is the upcoming Monday's week; a Monday review targets the week starting today.
 */

import { toDateStr } from "@/shared/lib/tasks/schedule";
import { readDoc, writeDoc } from "@/shared/lib/vault/client";
import { weeklyPath } from "@/shared/lib/vault/paths";
import type { VaultDoc, WeekDay, WeeklyFrontmatter } from "@/shared/lib/vault/schemas";

/** An in-memory weekly note: its frontmatter, flattened, plus path/body. */
export interface Weekly extends WeeklyFrontmatter {
  /** Relative vault path, e.g. "system/weekly/2026-W26.md". */
  path: string;
  /** Markdown body (free-form notes, unused by the review UI). */
  body: string;
}

/** Mon→Sun order for the Plan phase columns and recurring lookups. */
export const WEEK_DAYS: readonly WeekDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function toWeekly(doc: VaultDoc<WeeklyFrontmatter>): Weekly {
  return { ...doc.frontmatter, path: doc.path, body: doc.body };
}

/** Strip the in-memory-only fields back to a plain frontmatter object. */
function frontmatterOf(weekly: Weekly): Record<string, unknown> {
  const { path: _p, body: _b, ...fm } = weekly;
  return fm;
}

/** ISO-8601 week string (YYYY-Www) for a Date — anchored on Thursdays. */
function isoWeekOf(dt: Date): string {
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const dayNum = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dayNum + 3); // shift to this week's Thursday
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    );
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * The week the Weekly Review targets (D39): the upcoming Monday's ISO week. A
 * Monday review plans the week starting today; Tue–Sun plan the next Monday.
 */
export function comingWeek(now: Date = new Date()): string {
  return isoWeekOf(comingMonday(now));
}

/** The Monday (local Date) that starts the coming week. */
function comingMonday(now: Date): Date {
  const dayNum = now.getDay(); // Sun=0 … Sat=6
  const daysToMonday = (8 - dayNum) % 7; // Mon→0, Tue→6, …, Sun→1
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() + daysToMonday);
  return monday;
}

/** Monday (local Date) of a given ISO week string (YYYY-Www). */
function weekStartDate(week: string): Date {
  const [yStr, wStr] = week.split("-W");
  const y = Number(yStr);
  const w = Number(wStr);
  // Jan 4 is always in ISO week 1; back up to that week's Monday, then add weeks.
  const jan4 = new Date(y, 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7; // Mon=0
  const week1Monday = new Date(y, 0, 4 - jan4Day);
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (w - 1) * 7);
  return monday;
}

/** {date_start, date_end} (Mon, Sun) as YYYY-MM-DD for an ISO week string. */
export function weekBounds(week: string): { date_start: string; date_end: string } {
  const monday = weekStartDate(week);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { date_start: toDateStr(monday), date_end: toDateStr(sunday) };
}

/** Map each weekday → its concrete date (YYYY-MM-DD) within an ISO week. */
export function weekDayDates(week: string): Record<WeekDay, string> {
  const monday = weekStartDate(week);
  const out = {} as Record<WeekDay, string>;
  WEEK_DAYS.forEach((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out[day] = toDateStr(d);
  });
  return out;
}

/** The ISO week string immediately before `week` (its Monday minus 7 days). */
export function previousWeek(week: string): string {
  const monday = weekStartDate(week);
  monday.setDate(monday.getDate() - 7);
  return isoWeekOf(monday);
}

/** A human label like "Jun 22 – Jun 28" for a week's bounds. */
export function weekRangeLabel(week: string): string {
  const { date_start, date_end } = weekBounds(week);
  const fmt = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  return `${fmt(date_start)} – ${fmt(date_end)}`;
}

/** Read a weekly note, or null if it doesn't exist yet (never created). */
export async function readWeekly(week: string): Promise<Weekly | null> {
  try {
    const doc = (await readDoc(weeklyPath(week))) as VaultDoc<WeeklyFrontmatter>;
    if (doc.frontmatter?.type !== "weekly") return null;
    return toWeekly(doc);
  } catch {
    return null;
  }
}

/**
 * Start (lazy-create) the week's note. If it already exists it is reopened
 * verbatim — the review never recreates or overwrites a started week. Returns the
 * persisted note either way.
 */
export async function startWeekly(week: string): Promise<Weekly> {
  const existing = await readWeekly(week);
  if (existing) return existing;

  const { date_start, date_end } = weekBounds(week);
  const frontmatter: Record<string, unknown> = {
    type: "weekly",
    week,
    date_start,
    date_end,
  };
  const res = await writeDoc(weeklyPath(week), frontmatter, "");
  return toWeekly({ path: res.path, frontmatter: res.frontmatter as WeeklyFrontmatter, body: "" });
}

/**
 * Apply a patch to a weekly note in memory (pure — no I/O). The `progress` block
 * is shallow-merged so one phase can be marked complete at a time; keys set to
 * undefined are dropped so they don't persist as `null`.
 */
export function applyWeeklyPatch(weekly: Weekly, patch: Partial<WeeklyFrontmatter>): Weekly {
  const next: Weekly = { ...weekly, ...patch };

  if (patch.progress) next.progress = { ...weekly.progress, ...patch.progress };

  for (const key of Object.keys(patch) as (keyof WeeklyFrontmatter)[]) {
    if (patch[key] === undefined) delete (next as unknown as Record<string, unknown>)[key];
  }
  return next;
}

/** Persist a weekly note's frontmatter (patch via applyWeeklyPatch); returns it. */
export async function saveWeekly(
  weekly: Weekly,
  patch: Partial<WeeklyFrontmatter>,
): Promise<Weekly> {
  const merged = applyWeeklyPatch(weekly, patch);
  const res = await writeDoc(merged.path, frontmatterOf(merged), merged.body);
  return toWeekly({
    path: merged.path,
    frontmatter: res.frontmatter as WeeklyFrontmatter,
    body: merged.body,
  });
}

/** All three phases marked complete ⇒ the week is planned. */
export function isWeekPlanned(weekly: Weekly | null): boolean {
  const p = weekly?.progress;
  return !!p?.reflect && !!p?.maintain && !!p?.plan;
}
