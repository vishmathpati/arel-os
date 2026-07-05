/**
 * Tests for the human-readable run/change formatting — the layer that guarantees
 * the UI shows real names + amounts (never paths/IDs/slugs) and degrades cleanly
 * for older records that lack the enriched fields.
 */

import type { RunRecord, VaultChange } from "@/shared/lib/engine/client";
import { describe, expect, it } from "vitest";
import {
  changeKind,
  formatSchedule,
  groupChanges,
  pluralize,
  realChanges,
  runOutcome,
  summarizeChanges,
} from "./recipe-format";

function run(partial: Partial<RunRecord> & { changes: VaultChange[] }): RunRecord {
  return {
    at: "2026-06-23T14:39:00.000Z",
    status: "ok",
    trigger: "ui",
    model: "openai/gpt-5.4",
    durationMs: 54900,
    totalTokens: 886000,
    summary: "Done.",
    ...partial,
  };
}

// Rich changes — the shape a NEW run produces (label + kind + amount).
const RICH: VaultChange[] = [
  {
    op: "created",
    path: "databases/transactions/19eef.md",
    kind: "transaction",
    label: "Nawaz Fuels UPI debit",
    amount: "₹200",
  },
  {
    op: "created",
    path: "databases/transactions/19eee.md",
    kind: "transaction",
    label: "Swiggy order",
    amount: "₹420",
  },
  {
    op: "created",
    path: "databases/subscriptions/airtel.md",
    kind: "subscription",
    label: "Airtel 25+ OTTs",
    amount: "₹279",
  },
  {
    op: "updated",
    path: "databases/cards/sbi.md",
    kind: "card",
    label: "SBI Card 3390",
    amount: "₹32,390 outstanding",
  },
  { op: "updated", path: "system/recipes/finance-sync/log.md", kind: "log" },
];

// Old changes — pre-enrichment records carry only { op, path }.
const OLD: VaultChange[] = [
  { op: "created", path: "databases/transactions/19eef444d6064c83.md" },
  { op: "created", path: "databases/subscriptions/surfs-hark.md" },
  { op: "updated", path: "databases/cards/sbi-card-3390.md" },
  { op: "updated", path: "log.md" },
];

describe("changeKind", () => {
  it("prefers the stamped kind", () => {
    expect(changeKind(RICH[0])).toBe("transaction");
  });
  it("derives kind from path for old records (never shows the path)", () => {
    expect(changeKind(OLD[0])).toBe("transaction");
    expect(changeKind(OLD[1])).toBe("subscription");
    expect(changeKind(OLD[2])).toBe("card");
  });
  it("classifies the internal log so it can be filtered out", () => {
    expect(changeKind(RICH[4])).toBe("log");
    expect(changeKind(OLD[3])).toBe("log");
  });
});

describe("realChanges", () => {
  it("drops the internal log from both new and old records", () => {
    expect(realChanges(RICH)).toHaveLength(4);
    expect(realChanges(OLD)).toHaveLength(3);
  });
});

describe("summarizeChanges — human one-liner", () => {
  it("groups by kind + op with correct pluralization", () => {
    expect(summarizeChanges(RICH)).toBe("Added 2 transactions and 1 subscription · Updated 1 card");
  });
  it("works for old records too (counts only, no slugs)", () => {
    const s = summarizeChanges(OLD);
    expect(s).toBe("Added 1 transaction and 1 subscription · Updated 1 card");
    expect(s).not.toContain("surfs-hark");
    expect(s).not.toContain(".md");
  });
  it("says 'No changes' when only the log was touched", () => {
    expect(summarizeChanges([RICH[4]])).toBe("No changes");
  });
});

describe("groupChanges — detail with real names + amounts", () => {
  it("carries the actual name and amount for each item", () => {
    const groups = groupChanges(realChanges(RICH));
    const txns = groups.find((g) => g.kind === "transaction" && g.op === "created");
    expect(txns?.items).toEqual([
      { label: "Nawaz Fuels UPI debit", amount: "₹200" },
      { label: "Swiggy order", amount: "₹420" },
    ]);
    const sub = groups.find((g) => g.kind === "subscription");
    expect(sub?.items[0]).toEqual({ label: "Airtel 25+ OTTs", amount: "₹279" });
  });
  it("leaves items empty for old records (renders as count only)", () => {
    const groups = groupChanges(realChanges(OLD));
    expect(groups.every((g) => g.items.length === 0)).toBe(true);
  });
});

describe("runOutcome", () => {
  it("'changed' with a human headline when there are real writes", () => {
    const o = runOutcome(run({ changes: RICH }));
    expect(o.kind).toBe("changed");
    expect(o.headline).toContain("Added 2 transactions");
  });
  it("'none' when nothing meaningful changed", () => {
    const o = runOutcome(run({ changes: [], summary: "done (12 steps)" }));
    expect(o.kind).toBe("none");
  });
  it("'issue' when the run looks like it failed", () => {
    const o = runOutcome(
      run({ changes: [{ op: "updated", path: "log.md" }], summary: "gws not found in $PATH" }),
    );
    expect(o.kind).toBe("issue");
  });
});

describe("pluralize", () => {
  it("handles our nouns", () => {
    expect(pluralize("transaction")).toBe("transactions");
    expect(pluralize("bank account")).toBe("bank accounts");
    expect(pluralize("card")).toBe("cards");
  });
});

describe("formatSchedule", () => {
  it("renders cron twice-daily in plain language", () => {
    expect(formatSchedule("0 10,22 * * *")).toBe("Daily at 10:00 AM & 10:00 PM");
  });
  it("renders simple forms", () => {
    expect(formatSchedule("daily 09:30")).toBe("Daily at 9:30 AM");
    expect(formatSchedule("manual")).toBe("Manual");
    expect(formatSchedule("every 6h")).toBe("Every 6 hours");
  });
});

describe("schedule editor parse ↔ build round-trip", () => {
  it("twice-daily cron parses to a form and rebuilds to the daily-multi string", async () => {
    const { parseScheduleToForm, buildScheduleString } = await import("./recipe-format");
    const form = parseScheduleToForm("0 10,22 * * *");
    expect(form.cadence).toBe("twice");
    expect(form.times).toEqual(["10:00", "22:00"]);
    expect(buildScheduleString(form)).toBe("daily 10:00, 22:00");
  });

  it("daily-multi with independent minutes round-trips", async () => {
    const { parseScheduleToForm, buildScheduleString } = await import("./recipe-format");
    const form = parseScheduleToForm("daily 09:15, 21:45");
    expect(form.cadence).toBe("twice");
    expect(buildScheduleString(form)).toBe("daily 09:15, 21:45");
  });

  it("manual / weekly / interval forms build correctly", async () => {
    const { buildScheduleString } = await import("./recipe-format");
    expect(
      buildScheduleString({
        cadence: "manual",
        times: ["09:00", "21:00"],
        day: 1,
        intervalHours: 6,
      }),
    ).toBe("manual");
    expect(
      buildScheduleString({
        cadence: "weekly",
        times: ["08:00", "21:00"],
        day: 1,
        intervalHours: 6,
      }),
    ).toBe("weekly mon 08:00");
    expect(
      buildScheduleString({
        cadence: "interval",
        times: ["09:00", "21:00"],
        day: 1,
        intervalHours: 4,
      }),
    ).toBe("every 4h");
  });

  it("formatSchedule renders multi-time daily", async () => {
    const { formatSchedule } = await import("./recipe-format");
    expect(formatSchedule("daily 10:00, 22:00")).toBe("Daily at 10:00 AM & 10:00 PM");
    expect(formatSchedule("daily 09:15, 21:45")).toBe("Daily at 9:15 AM & 9:45 PM");
  });
});
