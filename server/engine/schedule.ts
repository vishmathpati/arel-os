/**
 * Schedule parsing and next-due calculation for the Engine scheduler.
 *
 * parseTrigger converts a recipe's `trigger` frontmatter string into a Rule.
 * nextDue computes the next fire time from a reference date (local-time based).
 *
 * Supported trigger formats:
 *   on-demand | manual   → null (never auto-fired)
 *   daily HH:MM          → fires every day at that local time
 *   weekly <Day> HH:MM   → fires every week on that day (Mon/Tue/…/Sun)
 *   monthly <DD> HH:MM   → fires every month on that day (clamps to last day)
 *   every <N>h           → fires every N hours from the previous run
 *   M H[,H,…] * * *      → cron subset: fires daily at the listed hours (minute M)
 *
 * A recipe may also put its schedule in a dedicated `schedule:` frontmatter field
 * (e.g. trigger: scheduled + schedule: "0 10,22 * * *"); the scheduler reads the
 * `schedule` field when present, falling back to `trigger`.
 */

export type Rule =
  | { type: "daily"; hour: number; minute: number }
  | { type: "weekly"; day: number; hour: number; minute: number } // day: 0=Sun … 6=Sat
  | { type: "monthly"; dayOfMonth: number; hour: number; minute: number }
  | { type: "interval"; hours: number }
  // Daily at one or more fixed times (e.g. cron "0 10,22 * * *" → 10:00 & 22:00).
  | { type: "times"; times: { hour: number; minute: number }[] };

function parseTime(s: string): { hour: number; minute: number } | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

const DAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

/** Parse a trigger string into a scheduling Rule, or null for on-demand/manual/unknown. */
export function parseTrigger(s: string): Rule | null {
  const lower = s.trim().toLowerCase();

  if (lower === "on-demand" || lower === "manual") return null;

  // daily HH:MM  (or several times: "daily 10:00, 22:30")
  const daily = lower.match(/^daily\s+(\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2})*)$/);
  if (daily) {
    const parsed = daily[1].split(",").map((s) => parseTime(s.trim()));
    if (parsed.some((t) => !t)) return null;
    const times = (parsed as { hour: number; minute: number }[]).sort(
      (a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute),
    );
    if (times.length === 1) return { type: "daily", hour: times[0].hour, minute: times[0].minute };
    return { type: "times", times };
  }

  // weekly <Day> HH:MM
  const weekly = lower.match(/^weekly\s+(\w{3})\s+(\d{1,2}:\d{2})$/);
  if (weekly) {
    const day = DAY_MAP[weekly[1]];
    if (day === undefined) return null;
    const t = parseTime(weekly[2]);
    if (!t) return null;
    return { type: "weekly", day, hour: t.hour, minute: t.minute };
  }

  // monthly <DD> HH:MM
  const monthly = lower.match(/^monthly\s+(\d{1,2})\s+(\d{1,2}:\d{2})$/);
  if (monthly) {
    const dayOfMonth = Number(monthly[1]);
    if (dayOfMonth < 1 || dayOfMonth > 31) return null;
    const t = parseTime(monthly[2]);
    if (!t) return null;
    return { type: "monthly", dayOfMonth, hour: t.hour, minute: t.minute };
  }

  // every <N>h
  const interval = lower.match(/^every\s+(\d+)h$/);
  if (interval) {
    const hours = Number(interval[1]);
    if (hours < 1) return null;
    return { type: "interval", hours };
  }

  // cron subset: "M H[,H,…] * * *" (minute, hour-list, any day/month/weekday).
  const cron = lower.match(/^(\d{1,2})\s+([\d,]+)\s+\*\s+\*\s+\*$/);
  if (cron) {
    const minute = Number(cron[1]);
    if (minute > 59) return null;
    const hours = cron[2]
      .split(",")
      .map((h) => Number(h))
      .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
    if (hours.length === 0) return null;
    const times = [...new Set(hours)].sort((a, b) => a - b).map((hour) => ({ hour, minute }));
    return { type: "times", times };
  }

  return null;
}

/**
 * Compute the next due time for a rule, strictly after `from`. Local-time based.
 *
 * Monthly rules clamp to the last day of the month when dayOfMonth exceeds the
 * month's length (e.g. monthly 31 in February → Feb 28/29).
 *
 * For interval rules, the result is always `from + N hours`, making catch-up
 * deterministic: the caller advances once after firing, then loops.
 */
export function nextDue(rule: Rule, from: Date): Date {
  if (rule.type === "interval") {
    return new Date(from.getTime() + rule.hours * 3_600_000);
  }

  if (rule.type === "daily") {
    const candidate = new Date(from);
    candidate.setHours(rule.hour, rule.minute, 0, 0);
    if (candidate <= from) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }

  if (rule.type === "times") {
    // Earliest of today's listed times that is strictly after `from`; else the
    // earliest listed time tomorrow. (times is pre-sorted ascending.)
    for (const t of rule.times) {
      const candidate = new Date(from);
      candidate.setHours(t.hour, t.minute, 0, 0);
      if (candidate > from) return candidate;
    }
    const first = rule.times[0];
    const tomorrow = new Date(from);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(first.hour, first.minute, 0, 0);
    return tomorrow;
  }

  if (rule.type === "weekly") {
    const candidate = new Date(from);
    candidate.setHours(rule.hour, rule.minute, 0, 0);
    const currentDay = candidate.getDay(); // 0=Sun
    let daysAhead = rule.day - currentDay;
    if (daysAhead < 0) daysAhead += 7;
    if (daysAhead === 0 && candidate <= from) daysAhead = 7;
    candidate.setDate(candidate.getDate() + daysAhead);
    return candidate;
  }

  // monthly
  const lastDayThisMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0).getDate();
  const dayThisMonth = Math.min(rule.dayOfMonth, lastDayThisMonth);
  const candidateThisMonth = new Date(from);
  candidateThisMonth.setDate(dayThisMonth);
  candidateThisMonth.setHours(rule.hour, rule.minute, 0, 0);

  if (candidateThisMonth > from) return candidateThisMonth;

  // Advance to next month.
  const firstOfNext = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  const lastDayNextMonth = new Date(
    firstOfNext.getFullYear(),
    firstOfNext.getMonth() + 1,
    0,
  ).getDate();
  const dayNextMonth = Math.min(rule.dayOfMonth, lastDayNextMonth);
  firstOfNext.setDate(dayNextMonth);
  firstOfNext.setHours(rule.hour, rule.minute, 0, 0);
  return firstOfNext;
}
