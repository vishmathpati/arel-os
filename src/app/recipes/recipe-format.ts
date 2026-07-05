/**
 * Human-readable formatting for recipe runs and changes. These are the functions
 * that turn the Engine's internal records into plain language for the Recipes UI —
 * no file paths, no IDs, no slugs ever reach the screen. Shared by the recipes
 * index and the per-recipe detail page (and unit-tested in recipe-format.test.ts).
 */

import type { RunRecord, VaultChange } from "@/shared/lib/engine/client";

export type OutcomeKind = "changed" | "none" | "issue";

export interface ChangeItem {
  /** The record's human title, e.g. "Airtel 25+ OTTs". */
  label?: string;
  /** The record's money value, e.g. "₹279". */
  amount?: string;
}

export interface ChangeGroupData {
  /** Human noun, singular (e.g. "transaction"). */
  kind: string;
  op: "created" | "updated";
  count: number;
  /** Individual items (only those that carry a human label show up named). */
  items: ChangeItem[];
}

/** Simple English pluralizer for our nouns ("bank account" → "bank accounts"). */
export function pluralize(noun: string): string {
  if (/(s|x|z|ch|sh)$/.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

/**
 * Human noun for a change. Prefers the server-stamped `kind`; for older records
 * that predate it, derives it from the path (used only to classify — never shown).
 */
export function changeKind(c: VaultChange): string {
  if (c.kind) return c.kind;
  const segs = c.path.split("/");
  const file = segs[segs.length - 1] ?? "";
  if (file === "log.md") return "log";
  if (segs[0] === "databases" && segs[1]) {
    const map: Record<string, string> = {
      transactions: "transaction",
      subscriptions: "subscription",
      cards: "card",
      "bank-accounts": "bank account",
      payments: "payment",
    };
    return map[segs[1]] ?? segs[1].replace(/s$/, "");
  }
  if (segs[0] === "system" && segs[1] === "summaries") return "summary";
  return segs[0] ?? "item";
}

/** Real, user-meaningful changes — the internal run log is never surfaced. */
export function realChanges(changes: VaultChange[]): VaultChange[] {
  return changes.filter((c) => changeKind(c) !== "log");
}

/** Group changes by (kind, op), collecting human labels + amounts for detail. */
export function groupChanges(changes: VaultChange[]): ChangeGroupData[] {
  const map = new Map<string, ChangeGroupData>();
  for (const c of changes) {
    const kind = changeKind(c);
    const key = `${kind}-${c.op}`;
    let g = map.get(key);
    if (!g) {
      g = { kind, op: c.op, count: 0, items: [] };
      map.set(key, g);
    }
    g.count++;
    if (c.label || c.amount) g.items.push({ label: c.label, amount: c.amount });
  }
  // Created groups first, then updated.
  return [...map.values()].sort((a, b) => (a.op === b.op ? 0 : a.op === "created" ? -1 : 1));
}

/** "5 transactions and 1 subscription" from a set of groups. */
function joinCounts(groups: ChangeGroupData[]): string {
  const parts = groups.map((g) => `${g.count} ${g.count === 1 ? g.kind : pluralize(g.kind)}`);
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** One-line plain summary, e.g. "Added 5 transactions and 1 subscription · Updated 2 cards". */
export function summarizeChanges(changes: VaultChange[]): string {
  const real = realChanges(changes);
  if (real.length === 0) return "No changes";
  const groups = groupChanges(real);
  const created = groups.filter((g) => g.op === "created");
  const updated = groups.filter((g) => g.op === "updated");
  const phrases: string[] = [];
  if (created.length) phrases.push(`Added ${joinCounts(created)}`);
  if (updated.length) phrases.push(`Updated ${joinCounts(updated)}`);
  return phrases.join(" · ");
}

/** Did the run fail to complete its job? Heuristic — status is always "ok" today. */
export function looksFailed(summary: string): boolean {
  return /\b(fail|failed|error|unavailable|couldn't|could not|not found|denied)\b/i.test(summary);
}

/** Turn a run into a plain-English outcome: what happened, in human terms. */
export function runOutcome(run: RunRecord): { kind: OutcomeKind; headline: string } {
  const real = realChanges(run.changes);
  if (real.length > 0) return { kind: "changed", headline: summarizeChanges(run.changes) };
  if (run.status === "failed" || looksFailed(run.summary)) {
    return { kind: "issue", headline: "Couldn't complete this run" };
  }
  return { kind: "none", headline: "No changes — everything was already up to date" };
}

// ── time + schedule formatting ──────────────────────────────────────────────────

/** Human-readable schedule label from a trigger string. */
export function formatSchedule(trigger: string): string {
  const lower = trigger.trim().toLowerCase();
  if (lower === "on-demand" || lower === "manual") return "Manual";

  const daily = lower.match(/^daily\s+(\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2})*)$/);
  if (daily) {
    const times = daily[1].split(",").map((s) => formatTime12(s.trim()));
    return times.length === 1 ? `Daily at ${times[0]}` : `Daily at ${times.join(" & ")}`;
  }

  const weekly = lower.match(/^weekly\s+(\w{3})\s+(\d{1,2}:\d{2})$/);
  if (weekly)
    return `Weekly · ${weekly[1].charAt(0).toUpperCase()}${weekly[1].slice(1)} ${formatTime12(weekly[2])}`;

  const monthly = lower.match(/^monthly\s+(\d{1,2})\s+(\d{1,2}:\d{2})$/);
  if (monthly) return `Monthly · day ${monthly[1]} at ${formatTime12(monthly[2])}`;

  const interval = lower.match(/^every\s+(\d+)h$/);
  if (interval) return `Every ${interval[1]} hours`;

  // Cron-style "0 10,22 * * *" → friendly "Twice daily (10:00, 22:00)".
  const cron = lower.match(/^\d+\s+([\d,]+)\s+\*\s+\*\s+\*$/);
  if (cron) {
    const hours = cron[1].split(",").map((h) => formatTime12(`${h}:00`));
    return hours.length > 1 ? `Daily at ${hours.join(" & ")}` : `Daily at ${hours[0]}`;
  }

  if (lower === "scheduled") return "Scheduled";
  return trigger; // unknown — show as-is
}

/** Convert "HH:MM" (24h) to "H:MM AM/PM". */
export function formatTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === undefined || m === undefined) return hhmm;
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

/** Compact relative time (e.g. "2h ago", "just now"). */
export function formatRelTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diffMs = Date.now() - ts;
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// ── schedule editor: parse a schedule string ↔ a simple form ────────────────────

export type Cadence = "manual" | "daily" | "twice" | "weekly" | "interval";

export interface ScheduleForm {
  cadence: Cadence;
  /** "HH:MM" entries — one for daily/weekly, two for twice-daily. */
  times: [string, string];
  /** 0=Sun … 6=Sat, for weekly. */
  day: number;
  /** Hours, for the interval cadence. */
  intervalHours: number;
}

const DAY_ABBR = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_FORM: ScheduleForm = {
  cadence: "manual",
  times: ["09:00", "21:00"],
  day: 1,
  intervalHours: 6,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Parse a schedule/trigger string into editor form state (best-effort, with sane defaults). */
export function parseScheduleToForm(schedule: string | undefined): ScheduleForm {
  const s = (schedule ?? "").trim().toLowerCase();
  if (!s || s === "manual" || s === "on-demand" || s === "scheduled") {
    return { ...DEFAULT_FORM };
  }

  // daily HH:MM[, HH:MM]
  const daily = s.match(/^daily\s+(\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2})*)$/);
  if (daily) {
    const times = daily[1].split(",").map((t) => t.trim());
    if (times.length === 1)
      return { ...DEFAULT_FORM, cadence: "daily", times: [times[0], "21:00"] };
    return { ...DEFAULT_FORM, cadence: "twice", times: [times[0], times[1]] };
  }

  // cron "M H[,H] * * *"
  const cron = s.match(/^(\d{1,2})\s+([\d,]+)\s+\*\s+\*\s+\*$/);
  if (cron) {
    const m = pad(Number(cron[1]));
    const hours = cron[2].split(",").map((h) => `${pad(Number(h))}:${m}`);
    if (hours.length === 1)
      return { ...DEFAULT_FORM, cadence: "daily", times: [hours[0], "21:00"] };
    return { ...DEFAULT_FORM, cadence: "twice", times: [hours[0], hours[1]] };
  }

  // weekly <Day> HH:MM
  const weekly = s.match(/^weekly\s+(\w{3})\s+(\d{1,2}:\d{2})$/);
  if (weekly) {
    const day = DAY_ABBR.indexOf(weekly[1]);
    return {
      ...DEFAULT_FORM,
      cadence: "weekly",
      day: day < 0 ? 1 : day,
      times: [weekly[2], "21:00"],
    };
  }

  // every Nh
  const interval = s.match(/^every\s+(\d+)h$/);
  if (interval) return { ...DEFAULT_FORM, cadence: "interval", intervalHours: Number(interval[1]) };

  return { ...DEFAULT_FORM };
}

/** Build the schedule string the backend stores from editor form state. */
export function buildScheduleString(form: ScheduleForm): string {
  switch (form.cadence) {
    case "manual":
      return "manual";
    case "daily":
      return `daily ${form.times[0]}`;
    case "twice":
      return `daily ${form.times[0]}, ${form.times[1]}`;
    case "weekly":
      return `weekly ${DAY_ABBR[form.day]} ${form.times[0]}`;
    case "interval":
      return `every ${Math.max(1, form.intervalHours)}h`;
  }
}

/** Compact absolute time (e.g. "Jun 22, 10:34 PM"). */
export function formatAbsTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
