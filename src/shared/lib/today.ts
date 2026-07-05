/**
 * Today board selector (Ch10 / D34) — the union of everything carrying a
 * today-state, computed live from the vault. Pure bucketing over the Chapter 3
 * task model + Chapter 6 quests; no storage of its own (the daily note holds
 * only the check-in answers). The Morning Manifesto re-derives this on every
 * open so it always reflects the current vault.
 *
 * Weekly-review per-day assignments (Ch13) are not faked here: once they exist
 * they carry concrete today dates and flow into these same buckets for free.
 */

import type { Quest } from "@/shared/lib/quest-data";
import { listQuests } from "@/shared/lib/quest-data";
import { isQuestFinished } from "@/shared/lib/quests";
import { scheduleBucket, scheduleSortKey, toDateStr } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { listTasks } from "@/shared/lib/tasks/tasks";

/** The categorized live snapshot the Morning Manifesto board renders. */
export interface TodayBundle {
  /** Past-due, still-actionable tasks — flagged. */
  overdue: Task[];
  /** Scheduled today (day-part). */
  today: Task[];
  /** Scheduled this evening 🌙. */
  evening: Task[];
  /** Reminders firing today (notify) — includes reminder-only nudges. */
  reminders: Task[];
  /** This week's focus quests (focus axis, not finished). */
  focusQuests: Quest[];
  /** Tasks completed today — feeds the momentum / progress ring. */
  completedToday: Task[];
}

const ACTIONABLE = new Set(["open", "waiting"]);
const TODAY_BUCKETS = new Set(["overdue", "today", "this-evening"]);

const bySchedule =
  (now: Date) =>
  (a: Task, b: Task): number => {
    const [ao, ad] = scheduleSortKey(a.schedule, now);
    const [bo, bd] = scheduleSortKey(b.schedule, now);
    return ao - bo || ad - bd;
  };

/** Bucket live tasks + quests into the Today board sections (pure; testable). */
export function buildTodayBundle(
  tasks: Task[],
  quests: Quest[],
  now: Date = new Date(),
): TodayBundle {
  const sort = bySchedule(now);
  const today: Task[] = [];
  const evening: Task[] = [];
  const overdue: Task[] = [];
  const reminders: Task[] = [];
  const completedToday: Task[] = [];
  const todayStr = toDateStr(now);

  for (const task of tasks) {
    if (task.status === "done") {
      if (task.completed?.startsWith(todayStr)) completedToday.push(task);
      continue;
    }
    if (!ACTIONABLE.has(task.status)) continue;

    const bucket = scheduleBucket(task.schedule, now);
    if (!TODAY_BUCKETS.has(bucket)) continue;

    // A reminder firing today surfaces in the reminders strip...
    if (task.notify) reminders.push(task);
    // ...but reminder-only nudges stay OUT of the work lists (Ch3 model).
    if (task.reminder_only) continue;

    if (bucket === "overdue") overdue.push(task);
    else if (bucket === "this-evening") evening.push(task);
    else today.push(task);
  }

  const focusQuests = quests
    .filter((q) => q.focus && !isQuestFinished(q.status))
    .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));

  return {
    overdue: overdue.sort(sort),
    today: today.sort(sort),
    evening: evening.sort(sort),
    reminders: reminders.sort(sort),
    focusQuests,
    completedToday,
  };
}

/** Load tasks + quests fresh and build the Today board snapshot. */
export async function loadTodayBundle(now: Date = new Date()): Promise<TodayBundle> {
  const [tasks, quests] = await Promise.all([listTasks(), listQuests()]);
  return buildTodayBundle(tasks, quests, now);
}
