import { describe, expect, it } from "vitest";
import type { Quest } from "./quest-data";
import type { Task } from "./tasks/tasks";
import { buildTodayBundle } from "./today";

// Pinned reference: Wednesday 2026-06-10, 09:00 local.
const NOW = new Date(2026, 5, 10, 9, 0);

const task = (over: Partial<Task>): Task => ({
  type: "task",
  status: "open",
  schedule: "2026-06-10",
  repeat: "none",
  notify: false,
  created: "2026-06-01T00:00:00.000Z",
  updated: "2026-06-01T00:00:00.000Z",
  path: "tasks/t.md",
  slug: "t",
  body: "",
  ...over,
});

const quest = (over: Partial<Quest>): Quest => ({
  type: "quest",
  area: "[[health]]",
  status: "active",
  deadline: "2026-12-31",
  created: "2026-06-01T00:00:00.000Z",
  updated: "2026-06-01T00:00:00.000Z",
  path: "quests/q/q.md",
  slug: "q",
  notes: "",
  ...over,
});

describe("buildTodayBundle", () => {
  it("buckets actionable tasks by derived schedule", () => {
    const b = buildTodayBundle(
      [
        task({ slug: "a", schedule: "2026-06-08" }), // overdue
        task({ slug: "b", schedule: "2026-06-10" }), // today
        task({ slug: "c", schedule: "2026-06-10T18:00" }), // this evening
        task({ slug: "d", schedule: "2026-06-12" }), // later this week — excluded
        task({ slug: "e", schedule: "someday" }), // excluded
      ],
      [],
      NOW,
    );
    expect(b.overdue.map((t) => t.slug)).toEqual(["a"]);
    expect(b.today.map((t) => t.slug)).toEqual(["b"]);
    expect(b.evening.map((t) => t.slug)).toEqual(["c"]);
  });

  it("excludes done/dropped from work lists; collects today's completions", () => {
    const b = buildTodayBundle(
      [
        task({ slug: "done-today", status: "done", completed: "2026-06-10T11:00:00.000Z" }),
        task({ slug: "done-earlier", status: "done", completed: "2026-06-09T11:00:00.000Z" }),
        task({ slug: "dropped", status: "dropped" }),
      ],
      [],
      NOW,
    );
    expect(b.today).toHaveLength(0);
    expect(b.completedToday.map((t) => t.slug)).toEqual(["done-today"]);
  });

  it("surfaces reminders but keeps reminder-only nudges out of work lists", () => {
    const b = buildTodayBundle(
      [
        task({ slug: "notify", notify: true }),
        task({ slug: "nudge", notify: true, reminder_only: true }),
      ],
      [],
      NOW,
    );
    expect(b.reminders.map((t) => t.slug)).toEqual(["notify", "nudge"]);
    expect(b.today.map((t) => t.slug)).toEqual(["notify"]); // nudge excluded from work
  });

  it("includes only unfinished focus quests", () => {
    const b = buildTodayBundle(
      [],
      [
        quest({ slug: "f1", title: "Ship", focus: true, status: "active" }),
        quest({ slug: "f2", title: "Done one", focus: true, status: "done" }),
        quest({ slug: "f3", title: "Not focused", focus: false }),
      ],
      NOW,
    );
    expect(b.focusQuests.map((q) => q.slug)).toEqual(["f1"]);
  });
});
