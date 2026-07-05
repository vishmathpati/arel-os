import { describe, expect, it } from "vitest";
import {
  type Weekly,
  applyWeeklyPatch,
  comingWeek,
  isWeekPlanned,
  weekBounds,
  weekDayDates,
} from "./weekly";

describe("comingWeek — the Sunday review targets the coming week (D39)", () => {
  it("Sunday → the very next day's (Monday's) week", () => {
    // Sunday 2026-06-21 → Monday 2026-06-22 starts W26.
    expect(comingWeek(new Date(2026, 5, 21, 18, 0))).toBe("2026-W26");
  });

  it("mid-week (Wed) → the upcoming Monday's week, not the current one", () => {
    // Wed 2026-06-24 is in W26; the next Monday 2026-06-29 starts W27.
    expect(comingWeek(new Date(2026, 5, 24, 9, 0))).toBe("2026-W27");
  });

  it("Monday → the week starting today", () => {
    // Monday 2026-06-22 itself starts W26.
    expect(comingWeek(new Date(2026, 5, 22, 9, 0))).toBe("2026-W26");
  });
});

describe("weekBounds / weekDayDates", () => {
  it("maps an ISO week to its Mon→Sun span", () => {
    expect(weekBounds("2026-W26")).toEqual({
      date_start: "2026-06-22",
      date_end: "2026-06-28",
    });
  });

  it("gives each weekday its concrete date", () => {
    const days = weekDayDates("2026-W26");
    expect(days.monday).toBe("2026-06-22");
    expect(days.wednesday).toBe("2026-06-24");
    expect(days.sunday).toBe("2026-06-28");
  });
});

describe("applyWeeklyPatch / isWeekPlanned", () => {
  const base: Weekly = {
    type: "weekly",
    week: "2026-W26",
    created: "2026-06-21T00:00:00.000Z",
    updated: "2026-06-21T00:00:00.000Z",
    path: "system/weekly/2026-W26.md",
    body: "",
  };

  it("shallow-merges the progress block one phase at a time", () => {
    const a = applyWeeklyPatch(base, { progress: { reflect: true } });
    const b = applyWeeklyPatch(a, { progress: { maintain: true } });
    expect(b.progress).toEqual({ reflect: true, maintain: true });
  });

  it("is planned only when all three phases are complete", () => {
    const partial = applyWeeklyPatch(base, { progress: { reflect: true, maintain: true } });
    expect(isWeekPlanned(partial)).toBe(false);
    const full = applyWeeklyPatch(partial, { progress: { plan: true } });
    expect(isWeekPlanned(full)).toBe(true);
  });

  it("drops keys explicitly set to undefined", () => {
    const withWins = applyWeeklyPatch(base, { wins: ["shipped Ch13"] });
    const cleared = applyWeeklyPatch(withWins, { wins: undefined });
    expect("wins" in cleared).toBe(false);
  });
});
