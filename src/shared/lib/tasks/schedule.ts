/**
 * Task schedule logic — the resolve-to-date model (Chapter 3 Contract).
 *
 * The picker offers buckets (Today / This Evening / Tomorrow / This Week / pick
 * a date / Someday / Unscheduled). Dated buckets RESOLVE to a concrete date the
 * moment they're chosen and are stored that way; only `someday`/`unscheduled`
 * stay as labels. The display group ("Overdue", "Today", …) is then DERIVED from
 * the stored date vs. now — so an untouched Today task becomes Overdue tomorrow.
 *
 * Overdue is day-granular: an evening task is not "overdue" at 18:01, only the
 * next day. All date math is local-time. Pure + browser-safe; `now` is injectable
 * for tests.
 */

import type { TaskSchedule, TaskScheduleLabel } from "@/shared/lib/vault/schemas";

/** Hour (local) at/after which a same-day time reads as "this evening". */
const EVENING_HOUR = 17;
/** Time stamped onto a "this evening" pick. */
const EVENING_TIME = "18:00";

/** A choice from the schedule picker (not all of these are stored verbatim). */
export type SchedulePick =
  | "today"
  | "this-evening"
  | "tomorrow"
  | "this-week"
  | "someday"
  | "unscheduled"
  | { date: string; time?: string };

/** The derived display group a task's schedule falls into. */
export type ScheduleBucket =
  | "overdue"
  | "today"
  | "this-evening"
  | "tomorrow"
  | "this-week"
  | "later"
  | "someday"
  | "unscheduled";

/** Fixed display order for grouping/sorting. */
export const BUCKET_ORDER: readonly ScheduleBucket[] = [
  "overdue",
  "today",
  "this-evening",
  "tomorrow",
  "this-week",
  "later",
  "someday",
  "unscheduled",
];

const LABELS: ReadonlySet<string> = new Set<TaskScheduleLabel>(["someday", "unscheduled"]);

// ── Local date helpers ───────────────────────────────────────────────────────

const pad = (n: number): string => String(n).padStart(2, "0");

/** Format a Date as a local `YYYY-MM-DD`. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local midnight of a Date. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const next = startOfDay(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Coming Sunday (week = Mon–Sun); today if today is Sunday. */
function endOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sun
  const daysUntilSunday = day === 0 ? 0 : 7 - day;
  return addDays(d, daysUntilSunday);
}

/** Parse a stored date-only or datetime string into a local Date (or null). */
function parseDate(value: string): { date: Date; hasTime: boolean } | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, day] = dateOnly;
    return { date: new Date(Number(y), Number(m) - 1, Number(day)), hasTime: false };
  }
  const dateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (dateTime) {
    const [, y, m, day, hh, mm] = dateTime;
    return {
      date: new Date(Number(y), Number(m) - 1, Number(day), Number(hh), Number(mm)),
      hasTime: true,
    };
  }
  return null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Is this stored schedule a non-dated label (someday/unscheduled)? */
export function isLabel(schedule: TaskSchedule): schedule is TaskScheduleLabel {
  return LABELS.has(schedule);
}

/** Resolve a picker choice into the value that gets stored in frontmatter. */
export function resolvePick(pick: SchedulePick, now: Date = new Date()): TaskSchedule {
  if (typeof pick === "object") {
    return pick.time ? `${pick.date}T${pick.time}` : pick.date;
  }
  switch (pick) {
    case "today":
      return toDateStr(now);
    case "this-evening":
      return `${toDateStr(now)}T${EVENING_TIME}`;
    case "tomorrow":
      return toDateStr(addDays(now, 1));
    case "this-week":
      return toDateStr(endOfWeek(now));
    default:
      return pick; // someday | unscheduled
  }
}

/** Derive the display bucket for a stored schedule. */
export function scheduleBucket(schedule: TaskSchedule, now: Date = new Date()): ScheduleBucket {
  if (schedule === "someday") return "someday";
  if (schedule === "unscheduled" || !schedule) return "unscheduled";

  const parsed = parseDate(schedule);
  if (!parsed) return "unscheduled";

  const todayMs = startOfDay(now).getTime();
  const dayMs = startOfDay(parsed.date).getTime();
  const oneDay = 86_400_000;
  const diffDays = Math.round((dayMs - todayMs) / oneDay);

  if (diffDays < 0) return "overdue";
  if (diffDays === 0) {
    return parsed.hasTime && parsed.date.getHours() >= EVENING_HOUR ? "this-evening" : "today";
  }
  if (diffDays === 1) return "tomorrow";
  if (dayMs <= endOfWeek(now).getTime()) return "this-week";
  return "later";
}

/** A task is overdue when it's still actionable and its date has passed. */
export function isOverdue(schedule: TaskSchedule, status: string, now: Date = new Date()): boolean {
  if (status === "done" || status === "dropped") return false;
  return scheduleBucket(schedule, now) === "overdue";
}

/** Sort key: bucket order, then the underlying date (earliest first). */
export function scheduleSortKey(schedule: TaskSchedule, now: Date = new Date()): [number, number] {
  const bucket = scheduleBucket(schedule, now);
  const order = BUCKET_ORDER.indexOf(bucket);
  const parsed = isLabel(schedule) ? null : parseDate(schedule);
  return [order, parsed ? parsed.date.getTime() : Number.MAX_SAFE_INTEGER];
}

/** Short human label for the schedule chip. */
export function formatSchedule(schedule: TaskSchedule, now: Date = new Date()): string {
  const bucket = scheduleBucket(schedule, now);
  switch (bucket) {
    case "today":
      return "Today";
    case "this-evening":
      return "This evening";
    case "tomorrow":
      return "Tomorrow";
    case "this-week":
      return "This week";
    case "someday":
      return "Someday";
    case "unscheduled":
      return "Unscheduled";
    default: {
      // overdue | later → show the concrete date
      const parsed = isLabel(schedule) ? null : parseDate(schedule);
      if (!parsed) return "Unscheduled";
      const label = parsed.date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      return bucket === "overdue" ? `Overdue · ${label}` : label;
    }
  }
}

/**
 * Advance a schedule by one recurrence step (for generating the next instance
 * when a recurring task is completed). Anchored on the task's current date, or
 * today if it has no concrete date. Preserves a time component if present.
 */
export function advanceSchedule(
  schedule: TaskSchedule,
  repeat: string,
  interval: number | undefined,
  now: Date = new Date(),
): TaskSchedule {
  const parsed = isLabel(schedule) ? null : parseDate(schedule);
  const anchor = parsed ? parsed.date : startOfDay(now);
  const time = parsed?.hasTime ? `T${pad(anchor.getHours())}:${pad(anchor.getMinutes())}` : "";

  let next: Date;
  switch (repeat) {
    case "daily":
      next = addDays(anchor, 1);
      break;
    case "every-n-days":
      next = addDays(anchor, Math.max(1, interval ?? 1));
      break;
    case "weekly":
      next = addDays(anchor, 7);
      break;
    case "monthly": {
      next = new Date(anchor);
      next.setMonth(next.getMonth() + 1);
      break;
    }
    default:
      return schedule;
  }
  return `${toDateStr(next)}${time}`;
}
