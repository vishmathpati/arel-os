import { describe, expect, it } from "vitest";
import {
  advanceSchedule,
  formatSchedule,
  isOverdue,
  resolvePick,
  scheduleBucket,
  scheduleSortKey,
} from "./schedule";

// Pinned reference: Wednesday 2026-06-10, 09:00 local. End of its week = Sun 2026-06-14.
const NOW = new Date(2026, 5, 10, 9, 0);

describe("resolvePick", () => {
  it("resolves dated buckets to concrete dates", () => {
    expect(resolvePick("today", NOW)).toBe("2026-06-10");
    expect(resolvePick("tomorrow", NOW)).toBe("2026-06-11");
    expect(resolvePick("this-evening", NOW)).toBe("2026-06-10T18:00");
    expect(resolvePick("this-week", NOW)).toBe("2026-06-14");
  });

  it("keeps non-dated labels as-is", () => {
    expect(resolvePick("someday", NOW)).toBe("someday");
    expect(resolvePick("unscheduled", NOW)).toBe("unscheduled");
  });

  it("resolves a picked date with optional time", () => {
    expect(resolvePick({ date: "2026-07-01" }, NOW)).toBe("2026-07-01");
    expect(resolvePick({ date: "2026-07-01", time: "08:30" }, NOW)).toBe("2026-07-01T08:30");
  });
});

describe("scheduleBucket", () => {
  it("derives the display group from the stored date", () => {
    expect(scheduleBucket("2026-06-09", NOW)).toBe("overdue");
    expect(scheduleBucket("2026-06-10", NOW)).toBe("today");
    expect(scheduleBucket("2026-06-10T18:00", NOW)).toBe("this-evening");
    expect(scheduleBucket("2026-06-10T09:00", NOW)).toBe("today"); // morning time = today
    expect(scheduleBucket("2026-06-11", NOW)).toBe("tomorrow");
    expect(scheduleBucket("2026-06-13", NOW)).toBe("this-week");
    expect(scheduleBucket("2026-06-14", NOW)).toBe("this-week"); // end of week
    expect(scheduleBucket("2026-06-20", NOW)).toBe("later");
  });

  it("passes labels through", () => {
    expect(scheduleBucket("someday", NOW)).toBe("someday");
    expect(scheduleBucket("unscheduled", NOW)).toBe("unscheduled");
  });

  it("an untouched Today task becomes Overdue the next day", () => {
    const stored = resolvePick("today", NOW); // "2026-06-10"
    const tomorrow = new Date(2026, 5, 11, 9, 0);
    expect(scheduleBucket(stored, NOW)).toBe("today");
    expect(scheduleBucket(stored, tomorrow)).toBe("overdue");
  });
});

describe("isOverdue", () => {
  it("is true only for actionable past-dated tasks", () => {
    expect(isOverdue("2026-06-09", "open", NOW)).toBe(true);
    expect(isOverdue("2026-06-09", "waiting", NOW)).toBe(true);
    expect(isOverdue("2026-06-09", "done", NOW)).toBe(false);
    expect(isOverdue("2026-06-09", "dropped", NOW)).toBe(false);
    expect(isOverdue("2026-06-10", "open", NOW)).toBe(false);
    expect(isOverdue("someday", "open", NOW)).toBe(false);
  });
});

describe("scheduleSortKey", () => {
  it("orders overdue before today before later", () => {
    const overdue = scheduleSortKey("2026-06-09", NOW);
    const today = scheduleSortKey("2026-06-10", NOW);
    const later = scheduleSortKey("2026-06-20", NOW);
    expect(overdue[0]).toBeLessThan(today[0]);
    expect(today[0]).toBeLessThan(later[0]);
  });
});

describe("formatSchedule", () => {
  it("uses bucket labels for the relative groups", () => {
    expect(formatSchedule("2026-06-10", NOW)).toBe("Today");
    expect(formatSchedule("2026-06-10T18:00", NOW)).toBe("This evening");
    expect(formatSchedule("2026-06-11", NOW)).toBe("Tomorrow");
    expect(formatSchedule("2026-06-13", NOW)).toBe("This week");
    expect(formatSchedule("someday", NOW)).toBe("Someday");
    expect(formatSchedule("unscheduled", NOW)).toBe("Unscheduled");
  });

  it("shows a concrete date for overdue/later", () => {
    expect(formatSchedule("2026-06-09", NOW).startsWith("Overdue")).toBe(true);
    expect(formatSchedule("2026-06-20", NOW)).not.toBe("Later");
  });
});

describe("advanceSchedule", () => {
  it("advances by the repeat rule", () => {
    expect(advanceSchedule("2026-06-10", "daily", undefined, NOW)).toBe("2026-06-11");
    expect(advanceSchedule("2026-06-10", "every-n-days", 3, NOW)).toBe("2026-06-13");
    expect(advanceSchedule("2026-06-10", "weekly", undefined, NOW)).toBe("2026-06-17");
    expect(advanceSchedule("2026-06-10", "monthly", undefined, NOW)).toBe("2026-07-10");
  });

  it("preserves a time component", () => {
    expect(advanceSchedule("2026-06-10T18:00", "daily", undefined, NOW)).toBe("2026-06-11T18:00");
  });

  it("returns the schedule unchanged when repeat is none", () => {
    expect(advanceSchedule("2026-06-10", "none", undefined, NOW)).toBe("2026-06-10");
  });
});
