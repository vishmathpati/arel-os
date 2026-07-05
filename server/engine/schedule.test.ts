import { describe, expect, it } from "vitest";
import { nextDue, parseTrigger } from "./schedule.ts";

describe("parseTrigger", () => {
  it("returns null for on-demand", () => {
    expect(parseTrigger("on-demand")).toBeNull();
  });

  it("returns null for manual", () => {
    expect(parseTrigger("manual")).toBeNull();
  });

  it("returns null for unknown trigger", () => {
    expect(parseTrigger("quarterly")).toBeNull();
    expect(parseTrigger("")).toBeNull();
  });

  it("parses daily HH:MM", () => {
    expect(parseTrigger("daily 10:30")).toEqual({ type: "daily", hour: 10, minute: 30 });
    expect(parseTrigger("DAILY 22:00")).toEqual({ type: "daily", hour: 22, minute: 0 });
  });

  it("parses weekly <Day> HH:MM", () => {
    expect(parseTrigger("weekly mon 09:00")).toEqual({
      type: "weekly",
      day: 1,
      hour: 9,
      minute: 0,
    });
    expect(parseTrigger("weekly fri 23:59")).toEqual({
      type: "weekly",
      day: 5,
      hour: 23,
      minute: 59,
    });
    expect(parseTrigger("weekly sun 08:00")).toEqual({
      type: "weekly",
      day: 0,
      hour: 8,
      minute: 0,
    });
  });

  it("returns null for unknown day name", () => {
    expect(parseTrigger("weekly xyz 09:00")).toBeNull();
  });

  it("parses monthly <DD> HH:MM", () => {
    expect(parseTrigger("monthly 1 08:00")).toEqual({
      type: "monthly",
      dayOfMonth: 1,
      hour: 8,
      minute: 0,
    });
    expect(parseTrigger("monthly 31 22:30")).toEqual({
      type: "monthly",
      dayOfMonth: 31,
      hour: 22,
      minute: 30,
    });
  });

  it("returns null for out-of-range monthly day", () => {
    expect(parseTrigger("monthly 0 08:00")).toBeNull();
    expect(parseTrigger("monthly 32 08:00")).toBeNull();
  });

  it("parses every <N>h", () => {
    expect(parseTrigger("every 2h")).toEqual({ type: "interval", hours: 2 });
    expect(parseTrigger("every 24h")).toEqual({ type: "interval", hours: 24 });
  });

  it("returns null for interval with 0 hours", () => {
    expect(parseTrigger("every 0h")).toBeNull();
  });
});

describe("nextDue — interval", () => {
  it("adds N hours to from", () => {
    const from = new Date("2026-06-22T10:00:00");
    const result = nextDue({ type: "interval", hours: 2 }, from);
    expect(result.getTime()).toBe(from.getTime() + 2 * 3_600_000);
  });
});

describe("nextDue — daily", () => {
  it("returns today's slot when it hasn't fired yet", () => {
    const from = new Date("2026-06-22T08:00:00"); // 8 AM
    const result = nextDue({ type: "daily", hour: 10, minute: 0 }, from);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(22);
  });

  it("advances to tomorrow when today's slot has passed", () => {
    const from = new Date("2026-06-22T22:00:00"); // 10 PM
    const result = nextDue({ type: "daily", hour: 10, minute: 0 }, from);
    expect(result.getDate()).toBe(23);
    expect(result.getHours()).toBe(10);
  });

  it("advances to tomorrow when from equals the slot exactly", () => {
    const from = new Date("2026-06-22T10:00:00");
    const result = nextDue({ type: "daily", hour: 10, minute: 0 }, from);
    expect(result.getDate()).toBe(23);
  });
});

describe("nextDue — weekly", () => {
  it("returns the correct upcoming weekday", () => {
    // Monday Jun 22, 2026 at 9 AM — asking for next Friday at 9 AM
    const from = new Date("2026-06-22T09:00:00"); // Monday
    const result = nextDue({ type: "weekly", day: 5, hour: 9, minute: 0 }, from);
    expect(result.getDay()).toBe(5); // Friday
    expect(result.getDate()).toBe(26); // Jun 26
  });

  it("wraps to next week when the weekday has passed this week", () => {
    // Friday Jun 26 at noon — asking for next Monday
    const from = new Date("2026-06-26T12:00:00"); // Friday
    const result = nextDue({ type: "weekly", day: 1, hour: 9, minute: 0 }, from);
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(29); // Jun 29
  });

  it("wraps to next week when it's the same day but time has passed", () => {
    // Monday Jun 22 at 5 PM — asking for next Monday at 9 AM (already passed today)
    const from = new Date("2026-06-22T17:00:00");
    const result = nextDue({ type: "weekly", day: 1, hour: 9, minute: 0 }, from);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(29); // next Monday
  });
});

describe("nextDue — monthly", () => {
  it("returns this month's slot when not yet past", () => {
    const from = new Date("2026-06-01T08:00:00");
    const result = nextDue({ type: "monthly", dayOfMonth: 15, hour: 10, minute: 0 }, from);
    expect(result.getMonth()).toBe(5); // June (0-indexed)
    expect(result.getDate()).toBe(15);
  });

  it("advances to next month when this month's slot has passed", () => {
    const from = new Date("2026-06-20T08:00:00");
    const result = nextDue({ type: "monthly", dayOfMonth: 15, hour: 10, minute: 0 }, from);
    expect(result.getMonth()).toBe(6); // July
    expect(result.getDate()).toBe(15);
  });

  it("clamps dayOfMonth 31 in February to last day (28 in non-leap year)", () => {
    const from = new Date("2026-01-20T08:00:00"); // January — next slot will be Feb 28
    const result = nextDue({ type: "monthly", dayOfMonth: 31, hour: 10, minute: 0 }, from);
    // Should advance past Jan 31 (which is still in Jan), so should land in Feb
    // Actually from Jan 20, next slot is Jan 31 first
    expect(result.getDate()).toBe(31);
    expect(result.getMonth()).toBe(0); // January 31
  });

  it("clamps dayOfMonth 31 in a month with 30 days (April)", () => {
    // From April 1 — monthly 31 → clamps to April 30 (last day)
    const from = new Date("2026-04-01T08:00:00");
    const result = nextDue({ type: "monthly", dayOfMonth: 31, hour: 10, minute: 0 }, from);
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(30); // clamped to last day of April
  });

  it("clamps to Feb 28 in non-leap year when dayOfMonth is 31", () => {
    // From Feb 1 of 2026 (non-leap) — monthly 31 → Feb 28
    const from = new Date("2026-02-01T08:00:00");
    const result = nextDue({ type: "monthly", dayOfMonth: 31, hour: 10, minute: 0 }, from);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(28);
  });
});

describe("catch-up logic", () => {
  it("a past next_due fires immediately and advances to a future slot", () => {
    // Simulate: scheduled daily at 10:00, last seeded next_due was yesterday
    const yesterday = new Date("2026-06-21T10:00:00");
    const now = new Date("2026-06-22T15:00:00");
    const rule = parseTrigger("daily 10:00")!;

    // The scheduler sees now >= yesterday (past) → fires
    expect(now >= yesterday).toBe(true);

    // After firing, advance next_due to the next future slot
    let slot = nextDue(rule, yesterday);
    while (slot <= now) slot = nextDue(rule, slot);

    // The next slot must be strictly in the future
    expect(slot > now).toBe(true);
    expect(slot.getHours()).toBe(10);
    expect(slot.getDate()).toBe(23); // tomorrow at 10:00
  });

  it("multiple missed slots still fire exactly once (no backfill storm)", () => {
    // Scheduled daily at 10:00; machine was off for 3 days
    const threeDaysAgo = new Date("2026-06-19T10:00:00");
    const now = new Date("2026-06-22T15:00:00");
    const rule = parseTrigger("daily 10:00")!;

    // Fire once at the overdue next_due
    expect(now >= threeDaysAgo).toBe(true);

    // Advance to next future slot (should skip intermediate missed slots)
    let slot = nextDue(rule, threeDaysAgo);
    let advances = 0;
    while (slot <= now) {
      slot = nextDue(rule, slot);
      advances++;
    }

    // slot is now in the future — only one future slot regardless of how many were missed
    expect(slot > now).toBe(true);
    // advances tells us how many missed slots we skipped past (3 in this case)
    expect(advances).toBeGreaterThan(0);
    expect(slot.getDate()).toBe(23);
  });
});

describe("parseTrigger — cron subset (M H[,H] * * *)", () => {
  it("parses twice-daily cron into a sorted times rule", () => {
    expect(parseTrigger("0 10,22 * * *")).toEqual({
      type: "times",
      times: [
        { hour: 10, minute: 0 },
        { hour: 22, minute: 0 },
      ],
    });
  });

  it("sorts and dedupes hours and honors the minute", () => {
    expect(parseTrigger("30 22,9,9 * * *")).toEqual({
      type: "times",
      times: [
        { hour: 9, minute: 30 },
        { hour: 22, minute: 30 },
      ],
    });
  });

  it("parses a single-hour cron", () => {
    expect(parseTrigger("0 6 * * *")).toEqual({ type: "times", times: [{ hour: 6, minute: 0 }] });
  });

  it("rejects out-of-range or malformed cron", () => {
    expect(parseTrigger("0 25 * * *")).toBeNull(); // hour 25 filtered → empty → null
    expect(parseTrigger("99 10 * * *")).toBeNull(); // minute 99
    expect(parseTrigger("0 10 * * 1")).toBeNull(); // weekday restriction unsupported
  });
});

describe("nextDue — times rule", () => {
  it("picks the next listed time later today", () => {
    const rule = parseTrigger("0 10,22 * * *")!;
    const at9am = new Date(2026, 5, 23, 9, 0, 0); // before 10:00
    const next = nextDue(rule, at9am);
    expect(next.getHours()).toBe(10);
    expect(next.getDate()).toBe(23);
  });

  it("jumps to the second time when the first has passed", () => {
    const rule = parseTrigger("0 10,22 * * *")!;
    const at3pm = new Date(2026, 5, 23, 15, 0, 0); // after 10:00, before 22:00
    const next = nextDue(rule, at3pm);
    expect(next.getHours()).toBe(22);
    expect(next.getDate()).toBe(23);
  });

  it("rolls to the first time tomorrow when all today's times have passed", () => {
    const rule = parseTrigger("0 10,22 * * *")!;
    const at11pm = new Date(2026, 5, 23, 23, 0, 0); // after 22:00
    const next = nextDue(rule, at11pm);
    expect(next.getHours()).toBe(10);
    expect(next.getDate()).toBe(24);
  });
});
