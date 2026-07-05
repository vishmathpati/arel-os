/**
 * Daily-note data layer (Ch10 / D34) — read-or-create + autosave over the
 * Chapter 2 vault client. One markdown file per day at `system/daily/<date>.md`.
 * Browser-only (the client uses fetch). No indexing/caching.
 *
 * The note stores ONLY the morning check-in answers (+ must_do / focus_quests).
 * The "Today board" surfaces are derived live elsewhere (today.ts), never here.
 *
 * The Morning Manifesto and Evening Shutdown (Ch11) share this one file: morning
 * answers live under `morning`, shutdown answers under `evening`.
 */

import { toDateStr } from "@/shared/lib/tasks/schedule";
import { readDoc, writeDoc } from "@/shared/lib/vault/client";
import { dailyPath } from "@/shared/lib/vault/paths";
import type { DailyFrontmatter, FocusLog, VaultDoc } from "@/shared/lib/vault/schemas";

/** An in-memory daily note: its frontmatter, flattened, plus path/body. */
export interface Daily extends DailyFrontmatter {
  /** Relative vault path, e.g. "system/daily/2026-06-16.md". */
  path: string;
  /** Markdown body (free-form notes, unused by the manifesto). */
  body: string;
}

function toDaily(doc: VaultDoc<DailyFrontmatter>): Daily {
  return { ...doc.frontmatter, path: doc.path, body: doc.body };
}

/** Strip the in-memory-only fields back to a plain frontmatter object. */
function frontmatterOf(daily: Daily): Record<string, unknown> {
  const { path: _p, body: _b, ...fm } = daily;
  return fm;
}

/** ISO-8601 week string (YYYY-Www) for a local `YYYY-MM-DD` — links daily→weekly. */
function isoWeek(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // Thursday-of-this-week trick: ISO weeks are anchored on Thursdays.
  const dt = new Date(y, m - 1, d);
  const dayNum = (dt.getDay() + 6) % 7; // Mon=0 … Sun=6
  dt.setDate(dt.getDate() - dayNum + 3);
  const firstThursday = new Date(dt.getFullYear(), 0, 4);
  const week =
    1 +
    Math.round(
      ((dt.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    );
  return `${dt.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Today's date as the vault filename stem (local). */
export function todayDate(now: Date = new Date()): string {
  return toDateStr(now);
}

/** Read a daily note, or null if it doesn't exist yet (never created). */
export async function readDaily(date: string): Promise<Daily | null> {
  try {
    const doc = (await readDoc(dailyPath(date))) as VaultDoc<DailyFrontmatter>;
    if (doc.frontmatter?.type !== "daily") return null;
    return toDaily(doc);
  } catch {
    return null;
  }
}

/**
 * Start (lazy-create) the day's note. If today's note already exists it is
 * reopened verbatim — the manifesto never recreates or overwrites a started
 * day (D34 DoD). Returns the persisted note either way.
 */
export async function startDaily(date: string): Promise<Daily> {
  const existing = await readDaily(date);
  if (existing) return existing;

  const frontmatter: Record<string, unknown> = {
    type: "daily",
    date,
    week: isoWeek(date),
  };
  const res = await writeDoc(dailyPath(date), frontmatter, "");
  return toDaily({ path: res.path, frontmatter: res.frontmatter as DailyFrontmatter, body: "" });
}

/** Shallow-merge a sub-block, dropping keys explicitly set to undefined. */
function mergeBlock<T extends object>(base: T | undefined, patch: T): T {
  const merged = { ...base, ...patch } as T;
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (patch[key] === undefined) delete merged[key];
  }
  return merged;
}

/**
 * Apply a patch to a daily note in memory (pure — no I/O). The `morning` and
 * `evening` blocks are shallow-merged (so the UI can update one answer at a
 * time); keys set to undefined are dropped so they don't persist as `null`. Used
 * both for optimistic UI state and as the body of `saveDaily`.
 */
export function applyDailyPatch(daily: Daily, patch: Partial<DailyFrontmatter>): Daily {
  const next: Daily = { ...daily, ...patch };

  if (patch.morning) next.morning = mergeBlock(daily.morning, patch.morning);
  if (patch.evening) next.evening = mergeBlock(daily.evening, patch.evening);

  for (const key of Object.keys(patch) as (keyof DailyFrontmatter)[]) {
    if (patch[key] === undefined) delete (next as unknown as Record<string, unknown>)[key];
  }
  return next;
}

/**
 * Persist a daily note's frontmatter (patch shallow-merged via applyDailyPatch);
 * returns the stamped note.
 */
export async function saveDaily(daily: Daily, patch: Partial<DailyFrontmatter>): Promise<Daily> {
  const merged = applyDailyPatch(daily, patch);
  const res = await writeDoc(merged.path, frontmatterOf(merged), merged.body);
  return toDaily({
    path: merged.path,
    frontmatter: res.frontmatter as DailyFrontmatter,
    body: merged.body,
  });
}

/**
 * Append one Focus Session log to today's note (Ch12). Lazy-creates the day if
 * it doesn't exist yet (a focus session is itself a reason for the day to exist).
 * Unlike the morning/evening blocks, `sessions` is an append-only array, so this
 * reads the current note fresh and pushes rather than shallow-merging.
 */
export async function appendSession(log: FocusLog, date = todayDate()): Promise<Daily> {
  const daily = await startDaily(date);
  const sessions = [...(daily.sessions ?? []), log];
  return saveDaily(daily, { sessions });
}
