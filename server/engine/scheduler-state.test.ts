/**
 * Tests for the scheduler-state read filtering — guards the regression where the
 * vault writer's `created`/`updated` timestamp stamps were misread as recipe
 * entries (producing a junk `created: {next_due:null,…}` row in schedule.md).
 *
 * readSchedulerState reads through the vault I/O layer, so the pure filtering
 * logic is replicated here (same approach as runlog.test.ts) and asserted against
 * representative frontmatter.
 */

import { describe, expect, it } from "vitest";
import type { SchedulerEntry } from "./scheduler-state.ts";

const RESERVED_KEYS = new Set(["created", "updated"]);

function coerceEntry(raw: unknown): SchedulerEntry {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { next_due: null, last_fired: null, last_status: null };
  }
  const r = raw as Record<string, unknown>;
  return {
    next_due: typeof r.next_due === "string" ? r.next_due : null,
    last_fired: typeof r.last_fired === "string" ? r.last_fired : null,
    last_status: r.last_status === "ok" || r.last_status === "failed" ? r.last_status : null,
  };
}

/** Same filtering as readSchedulerState's loop. */
function readState(fm: Record<string, unknown>): Record<string, SchedulerEntry> {
  const state: Record<string, SchedulerEntry> = {};
  for (const [name, val] of Object.entries(fm)) {
    if (RESERVED_KEYS.has(name)) continue;
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    state[name] = coerceEntry(val);
  }
  return state;
}

describe("scheduler-state read filtering", () => {
  it("keeps recipe entries and ignores created/updated stamps", () => {
    const fm = {
      "finance-sync": {
        next_due: "2026-06-23T16:30:00.000Z",
        last_fired: "2026-06-23T10:09:16.511Z",
        last_status: "ok",
      },
      created: "2026-06-23T09:56:43.885Z",
      updated: "2026-06-23T10:09:49.108Z",
    };
    const state = readState(fm);
    expect(Object.keys(state)).toEqual(["finance-sync"]);
    expect(state["finance-sync"].next_due).toBe("2026-06-23T16:30:00.000Z");
    expect(state["finance-sync"].last_status).toBe("ok");
  });

  it("does not resurrect a corrupted created-as-object entry", () => {
    const fm = {
      "finance-sync": { next_due: "2026-06-23T16:30:00.000Z", last_fired: null, last_status: null },
      created: { next_due: null, last_fired: null, last_status: null }, // corruption from the old bug
      updated: "2026-06-23T10:09:49.108Z",
    };
    const state = readState(fm);
    expect(Object.keys(state)).toEqual(["finance-sync"]);
    expect(state).not.toHaveProperty("created");
  });

  it("skips scalar junk keys", () => {
    const fm = {
      "finance-sync": { next_due: "x", last_fired: null, last_status: null },
      note: "hi",
    };
    expect(Object.keys(readState(fm))).toEqual(["finance-sync"]);
  });
});
