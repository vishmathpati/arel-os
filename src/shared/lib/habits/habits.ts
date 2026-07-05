/**
 * Habit data layer — habits are recurring tasks with `habit: true`. This layer
 * sits on top of the task data layer; it does NOT introduce a new primitive type.
 *
 * Locked architecture (agents/BRIEF.md): a habit is a task with habit=true,
 * repeat set, and a completions[] log. The task engine handles all CRUD; this
 * layer adds listHabits, createHabit, toggleHabitCompletion, and stat helpers.
 */

import { listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import { slugify, taskPath } from "@/shared/lib/vault/paths";
import type { HabitCompletion, TaskFrontmatter, VaultDoc } from "@/shared/lib/vault/schemas";

// ── Habit type ────────────────────────────────────────────────────────────────

/** In-memory habit: TaskFrontmatter flattened + path/slug/body. */
export interface Habit extends TaskFrontmatter {
  path: string;
  slug: string;
  body: string;
  // Required for habits (narrowed from optional in TaskFrontmatter)
  habit: true;
}

export interface CreateHabitInput {
  title: string;
  /** Area slug (bare, e.g. "health"). */
  area?: string;
  /** Repeat rule — must NOT be "none" for a habit. */
  repeat: "daily" | "every-n-days" | "weekly";
  repeat_interval?: number;
  habit_display?: "heatmap" | "bar";
  habit_target?: number;
  habit_unit?: string;
  habit_icon?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toHabit(doc: VaultDoc<TaskFrontmatter>): Habit {
  const slug = doc.path.replace(/^tasks\//, "").replace(/\.md$/, "");
  return {
    ...doc.frontmatter,
    habit: true,
    path: doc.path,
    slug,
    body: doc.body,
    completions: doc.frontmatter.completions ?? [],
  };
}

function frontmatterOf(habit: Habit): Record<string, unknown> {
  const { path: _p, slug: _s, body: _b, ...fm } = habit;
  return fm;
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "habit";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** All habits (tasks where habit === true), read fresh. */
export async function listHabits(): Promise<Habit[]> {
  const { entries } = await listDir("tasks");
  const files = entries.filter((e) => e.type === "file");
  const docs = await Promise.all(files.map((e) => readDoc(e.path)));
  return docs
    .map((doc) => doc as VaultDoc<TaskFrontmatter>)
    .filter(
      (doc) =>
        doc.frontmatter?.type === "task" &&
        !doc.frontmatter.deleted &&
        doc.frontmatter.habit === true,
    )
    .map(toHabit);
}

/** Read one habit, or null if missing / not a habit. */
export async function readHabit(slug: string): Promise<Habit | null> {
  try {
    const doc = (await readDoc(taskPath(slug))) as VaultDoc<TaskFrontmatter>;
    if (doc.frontmatter?.type !== "task" || !doc.frontmatter.habit) return null;
    return toHabit(doc);
  } catch {
    return null;
  }
}

/** Create a habit (a recurring task with habit: true). */
export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const { entries } = await listDir("tasks");
  const taken = new Set(
    entries
      .filter((e) => e.type === "file")
      .map((e) => e.path.replace(/^tasks\//, "").replace(/\.md$/, "")),
  );
  const slug = uniqueSlug(slugify(input.title), taken);

  const frontmatter: Record<string, unknown> = {
    type: "task",
    title: input.title,
    status: "open",
    schedule: todayStr(),
    repeat: input.repeat,
    notify: false,
    habit: true,
    habit_display: input.habit_display ?? "heatmap",
    completions: [],
  };
  if (input.area) frontmatter.area = `[[${input.area}]]`;
  if (input.repeat_interval !== undefined) frontmatter.repeat_interval = input.repeat_interval;
  if (input.habit_target !== undefined) frontmatter.habit_target = input.habit_target;
  if (input.habit_unit) frontmatter.habit_unit = input.habit_unit;
  if (input.habit_icon) frontmatter.habit_icon = input.habit_icon;

  const res = await writeDoc(taskPath(slug), frontmatter, "");
  return toHabit({ path: res.path, frontmatter: res.frontmatter as TaskFrontmatter, body: "" });
}

/** Patch a habit's frontmatter; returns the updated habit. */
export async function updateHabit(
  habit: Habit,
  patch: Partial<TaskFrontmatter>,
  body: string = habit.body,
): Promise<Habit> {
  const frontmatter = { ...frontmatterOf(habit), ...patch };
  for (const key of Object.keys(patch) as (keyof TaskFrontmatter)[]) {
    if (patch[key] === undefined) delete frontmatter[key];
  }
  const res = await writeDoc(habit.path, frontmatter, body);
  return toHabit({ path: habit.path, frontmatter: res.frontmatter as TaskFrontmatter, body });
}

/**
 * Toggle a completion entry for a given ISO date.
 * - If no entry exists for that date → adds one (with optional value).
 * - If an entry exists → removes it (un-tick).
 * Returns the updated habit.
 */
export async function toggleHabitCompletion(
  habit: Habit,
  isoDate: string,
  value?: number,
): Promise<Habit> {
  const completions = habit.completions ?? [];
  const idx = completions.findIndex((c) => c.date === isoDate);
  let next: HabitCompletion[];
  if (idx >= 0) {
    // Remove
    next = completions.filter((_, i) => i !== idx);
  } else {
    // Add
    const entry: HabitCompletion = { date: isoDate };
    if (value !== undefined) entry.value = value;
    next = [...completions, entry];
  }
  return updateHabit(habit, { completions: next });
}

// ── Stat helpers ──────────────────────────────────────────────────────────────

/** Today as YYYY-MM-DD (local date, not UTC). */
export function todayStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/** True if the habit has a completion entry for the given date. */
export function isCompletedOn(habit: Habit, date: string): boolean {
  return (habit.completions ?? []).some((c) => c.date === date);
}

/** Completion value for a date (quantity habits), or undefined. */
export function valueOn(habit: Habit, date: string): number | undefined {
  return (habit.completions ?? []).find((c) => c.date === date)?.value;
}

/**
 * Current streak — consecutive days ending today (or yesterday if not done
 * today) where the habit was completed. Counts backward from today.
 */
function localDateStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function currentStreak(habit: Habit): number {
  const completedDates = new Set((habit.completions ?? []).map((c) => c.date));
  const today = todayStr();
  let streak = 0;
  const cursor = new Date();

  // If not done today, don't break the streak — count from yesterday back
  if (!completedDates.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const d = localDateStr(cursor);
    if (!completedDates.has(d)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Longest streak ever. */
export function longestStreak(habit: Habit): number {
  const dates = (habit.completions ?? []).map((c) => c.date).sort();
  if (dates.length === 0) return 0;

  let max = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]);
    const curr = new Date(dates[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      run++;
      if (run > max) max = run;
    } else if (diff > 1) {
      run = 1;
    }
    // diff === 0 (duplicate) is ignored
  }
  return max;
}

/**
 * Completion percentage over the last `days` days (default 30).
 * Returns 0–100 (integer).
 */
export function completionPercent(habit: Habit, days = 30): number {
  const completedDates = new Set((habit.completions ?? []).map((c) => c.date));
  let count = 0;
  const cursor = new Date();
  for (let i = 0; i < days; i++) {
    const d = localDateStr(cursor);
    if (completedDates.has(d)) count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return Math.round((count / days) * 100);
}

/**
 * Build a week-grid for heatmap rendering. Returns an array of weeks
 * (oldest first), each an array of 7 day entries (Sun→Sat). Spans from
 * `weeksBack` weeks ago through today.
 */
export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  /** completed, partial, or empty */
  completed: boolean;
  value?: number;
  /** true if day is in the future */
  future: boolean;
}

export function buildHeatmapGrid(habit: Habit, weeksBack = 52): HeatmapDay[][] {
  const completedDates = new Map((habit.completions ?? []).map((c) => [c.date, c.value]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Use local date components to avoid UTC-offset issues with toISOString()
  const todayStr_ = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  // Find the Sunday of the week that is weeksBack weeks ago
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (weeksBack - 1) * 7);

  const weeks: HeatmapDay[][] = [];
  const cursor = new Date(start);

  for (let w = 0; w < weeksBack; w++) {
    const week: HeatmapDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = localDateStr(cursor);
      const future = dateStr > todayStr_;
      week.push({
        date: dateStr,
        completed: completedDates.has(dateStr),
        value: completedDates.get(dateStr),
        future,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
