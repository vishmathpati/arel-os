/**
 * Arel Focus bridge contract — v2 (Chapter 12).
 *
 * Arel OS owns the timer and the session; Arel Focus owns website blocking during
 * the Work phase. The two are linked ONLY by profile selection. This file is the
 * single source of truth for every profile and its block/allow domains — the
 * Swift app is told what to block, it no longer decides.
 *
 * Transport is file-based (see agents/docs/AREL-FOCUS-BRIDGE-V2.md). The frontend
 * never touches the bridge dir directly; it calls the Bun vault server.
 */

export const AREL_FOCUS_SCHEMA_VERSION = "arel-focus-hour.v2" as const;
export type ArelFocusSchemaVersion = typeof AREL_FOCUS_SCHEMA_VERSION;

// ── Profiles (owned here) ─────────────────────────────────────────────────────

export type FocusProfileId = "deep_work" | "coding" | "research" | "writing" | "creating" | "admin";

export interface FocusProfile {
  id: FocusProfileId;
  label: string;
  /** One-line description shown under the profile in the picker. */
  blurb: string;
  /** ACTUAL domains Arel Focus blocks during Work. */
  blocked: string[];
  /** Informational — domains deliberately NOT blocked (shown to the user, not enforced). */
  allowed: string[];
}

/** Common distraction domains, grouped so profiles compose from intent, not copy-paste. */
const SOCIAL = [
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "reddit.com",
  "tiktok.com",
];
const VIDEO = ["youtube.com", "netflix.com", "primevideo.com", "hotstar.com"];
const NEWS = ["news.google.com"];
const SHOPPING = ["amazon.com", "flipkart.com"];

const uniq = (xs: string[]) => Array.from(new Set(xs)).sort();

/**
 * The seed profiles. Edit freely — these flow straight to Arel Focus on the next
 * session; no recompile. "Creating" keeps YouTube open for video work; "Research"
 * keeps YouTube + X + Reddit (useful, not junk); "Admin" keeps shopping for errands.
 */
export const FOCUS_PROFILES: FocusProfile[] = [
  {
    id: "deep_work",
    label: "Deep Work",
    blurb: "Hardest cognitive work — everything distracting is off.",
    blocked: uniq([...SOCIAL, ...VIDEO, ...NEWS, ...SHOPPING]),
    allowed: [],
  },
  {
    id: "coding",
    label: "Coding",
    blurb: "Building. Docs, GitHub, localhost, AI tools stay open.",
    blocked: uniq([...SOCIAL, ...VIDEO, ...NEWS, ...SHOPPING]),
    allowed: ["github.com", "localhost", "developer.mozilla.org", "stackoverflow.com"],
  },
  {
    id: "research",
    label: "Research",
    blurb: "Learning and exploring — YouTube, X and Reddit stay open as tools.",
    blocked: uniq([
      "facebook.com",
      "instagram.com",
      "tiktok.com",
      "netflix.com",
      "primevideo.com",
      "hotstar.com",
      ...SHOPPING,
    ]),
    allowed: ["youtube.com", "x.com", "twitter.com", "reddit.com"],
  },
  {
    id: "writing",
    label: "Writing",
    blurb: "Drafting — feeds and video off, references stay.",
    blocked: uniq([...SOCIAL, ...VIDEO, ...NEWS]),
    allowed: [],
  },
  {
    id: "creating",
    label: "Creating",
    blurb: "Making videos/content — YouTube and creative tools stay open.",
    blocked: uniq([
      "facebook.com",
      "instagram.com",
      "reddit.com",
      "tiktok.com",
      "netflix.com",
      "primevideo.com",
      ...NEWS,
      ...SHOPPING,
    ]),
    allowed: ["youtube.com"],
  },
  {
    id: "admin",
    label: "Admin",
    blurb: "Errands and admin — email, calendar, finance, shopping stay open.",
    blocked: uniq([...SOCIAL, ...VIDEO]),
    allowed: ["amazon.com", "flipkart.com"],
  },
];

export function getFocusProfile(id: string | null | undefined): FocusProfile | null {
  return FOCUS_PROFILES.find((p) => p.id === id) ?? null;
}

// ── Targets ───────────────────────────────────────────────────────────────────

export type FocusTargetKind = "task" | "project" | "quest" | "area";

export interface FocusTarget {
  /** Vault slug / id of the thing being worked on. */
  slug: string;
  kind: FocusTargetKind;
  title: string;
}

// ── Durations / phases ─────────────────────────────────────────────────────────

export type FocusPhase = "plan" | "work" | "reflect";

export interface FocusDurations {
  plan_min: number;
  work_min: number;
  reflect_min: number;
}

/** Length presets that fill the three phase fields (each stays individually editable). */
export interface FocusPreset {
  id: string;
  label: string;
  durations: FocusDurations;
}

export const FOCUS_PRESETS: FocusPreset[] = [
  { id: "sprint", label: "25m", durations: { plan_min: 2, work_min: 20, reflect_min: 3 } },
  { id: "hour", label: "1h", durations: { plan_min: 5, work_min: 50, reflect_min: 5 } },
  { id: "deep", label: "2h", durations: { plan_min: 10, work_min: 100, reflect_min: 10 } },
];

export const DEFAULT_DURATIONS: FocusDurations = { plan_min: 5, work_min: 50, reflect_min: 5 };

export function totalMinutes(d: FocusDurations): number {
  return d.plan_min + d.work_min + d.reflect_min;
}

/** Seconds → "M:SS" (or "H:MM:SS" past an hour) for the countdown display. */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// ── Runtime state (mirrors Arel Focus) ──────────────────────────────────────────

export type FocusRuntimeState =
  | "idle"
  | "planning"
  | "working"
  | "reflecting"
  | "rescued"
  | "completed"
  | "cancelled";

export type FocusOutcome = "completed" | "cancelled" | "rescued";

// ── Commands (Arel OS → Arel Focus, written as files) ─────────────────────────────

const PRIVACY = {
  screenshots: false,
  keylogging: false,
  clipboard_capture: false,
  team_surveillance: false,
} as const;

export interface FocusStartCommand {
  schema_version: ArelFocusSchemaVersion;
  command: "start_focus_hour";
  session_id: string;
  /** The focus target — task/project/quest/area all map into this entity slot. */
  project: { id: string; name: string };
  task?: { id: string; name: string };
  profile_id: string;
  profile: FocusProfile;
  durations: FocusDurations;
  plan_notes: string;
  /** ISO — the moment the Work phase starts. */
  start_at: string;
  requested_by: "arel-os";
  privacy: typeof PRIVACY;
}

export interface FocusUpdateCommand {
  schema_version: ArelFocusSchemaVersion;
  command: "update_focus_hour";
  session_id: string;
  /** The full new effective block list (authoritative — powers temp-allow). */
  blocked: string[];
  requested_at: string;
  requested_by: "arel-os";
}

export interface FocusCancelCommand {
  schema_version: ArelFocusSchemaVersion;
  command: "cancel_focus_hour";
  session_id: string;
  requested_at: string;
  requested_by: "arel-os";
}

export interface FocusRescueCommand {
  schema_version: ArelFocusSchemaVersion;
  command: "rescue_focus_hour";
  session_id: string;
  reason?: string;
  requested_at: string;
  requested_by: "arel-os";
}

export type FocusCommand =
  | FocusStartCommand
  | FocusUpdateCommand
  | FocusCancelCommand
  | FocusRescueCommand;

/** The command-file suffix Arel Focus keys on (`{sessionId}.<suffix>.json`). */
export function commandSuffix(command: FocusCommand["command"]): string {
  switch (command) {
    case "start_focus_hour":
      return "start";
    case "update_focus_hour":
      return "update";
    case "cancel_focus_hour":
      return "cancel";
    case "rescue_focus_hour":
      return "rescue";
  }
}

// ── State / result (Arel Focus → Arel OS, read as files) ──────────────────────────

export interface FocusStateSnapshot {
  schema_version: ArelFocusSchemaVersion;
  state: FocusRuntimeState;
  session_id: string | null;
  updated_at: string;
  source: "arel-focus";
  profile_id?: string;
  blocked_now?: string[];
  allowed_overrides?: string[];
}

export interface FocusSessionResult {
  schema_version: ArelFocusSchemaVersion;
  session_id: string;
  state: FocusOutcome;
  started_at: string;
  ended_at: string;
  profile_id: string;
  actual_durations: { plan_min: number; work_min: number; reflect_min: number; total_min: number };
  work: { apps_used: string[]; websites_used: string[]; blocked_site_attempts: string[] };
  allowed_overrides: string[];
}

// ── Builders ─────────────────────────────────────────────────────────────────

/** afh-YYYYMMDDhhmmss-xxxxxx (matches Arel Focus's id shape). */
export function createSessionId(now: Date = new Date(), suffix?: string): string {
  const stamp = now
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const rand = suffix ?? Math.random().toString(36).slice(2, 8);
  return `afh-${stamp}-${rand}`;
}

export function buildStartCommand(input: {
  sessionId: string;
  target: FocusTarget;
  task?: { id: string; name: string };
  profile: FocusProfile;
  durations: FocusDurations;
  planNotes: string;
  startAt: string;
}): FocusStartCommand {
  return {
    schema_version: AREL_FOCUS_SCHEMA_VERSION,
    command: "start_focus_hour",
    session_id: input.sessionId,
    project: { id: input.target.slug, name: input.target.title },
    task: input.task,
    profile_id: input.profile.id,
    profile: input.profile,
    durations: input.durations,
    plan_notes: input.planNotes,
    start_at: input.startAt,
    requested_by: "arel-os",
    privacy: PRIVACY,
  };
}
