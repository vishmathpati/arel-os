/**
 * Focus session state machine (Ch12) — pure logic, no I/O, no React. The session
 * is the source of truth for the timer; Arel Focus blocking is a bonus layered on
 * top via profile selection. Phase countdowns are computed from timestamps (not a
 * tick counter) so a throttled/backgrounded tab can't drift the clock, and a
 * refreshed browser recovers the running phase exactly.
 *
 * Phases: plan → work → reflect → done. Each phase has a configurable countdown;
 * the user can advance early (Start work now / End early / Skip), and any phase
 * that runs out auto-advances. Plan & reflect are "soft" (escapable); work is the
 * one that actually drives blocking when a profile is selected.
 */

import type {
  FocusDurations,
  FocusOutcome,
  FocusProfile,
  FocusTarget,
} from "@/shared/lib/focus/contract";

export type SessionPhase = "plan" | "work" | "reflect" | "done";

export interface FocusReflection {
  done: string;
  unfinished: string;
  next: string;
}

export interface ActiveSession {
  id: string;
  target: FocusTarget;
  /** null = standalone (no blocking). */
  profileId: string | null;
  durations: FocusDurations;
  planNotes: string;
  reflection: FocusReflection;
  /** ISO timestamps marking when each phase began (null until entered). */
  planStartedAt: string | null;
  workStartedAt: string | null;
  reflectStartedAt: string | null;
  endedAt: string | null;
  phase: SessionPhase;
  outcome: FocusOutcome | null;
  rescue: { used: boolean; reason?: string };
  /** Domains temp-allowed this session (subtracted from the profile's block list). */
  allowedOverrides: string[];
}

export const STORAGE_KEY = "arelos.focus.active";

export function emptyReflection(): FocusReflection {
  return { done: "", unfinished: "", next: "" };
}

/** Begin a session — enters the plan phase immediately. */
export function startSession(input: {
  id: string;
  target: FocusTarget;
  profileId: string | null;
  durations: FocusDurations;
  planNotes: string;
  now?: Date;
}): ActiveSession {
  const now = (input.now ?? new Date()).toISOString();
  return {
    id: input.id,
    target: input.target,
    profileId: input.profileId,
    durations: input.durations,
    planNotes: input.planNotes,
    reflection: emptyReflection(),
    planStartedAt: now,
    workStartedAt: null,
    reflectStartedAt: null,
    endedAt: null,
    phase: "plan",
    outcome: null,
    rescue: { used: false },
    allowedOverrides: [],
  };
}

/** When did the current phase start (ISO)? */
export function phaseStartedAt(s: ActiveSession): string | null {
  switch (s.phase) {
    case "plan":
      return s.planStartedAt;
    case "work":
      return s.workStartedAt;
    case "reflect":
      return s.reflectStartedAt;
    case "done":
      return s.endedAt;
  }
}

/** Configured length of the current phase, in seconds. */
export function phaseDurationSec(s: ActiveSession): number {
  switch (s.phase) {
    case "plan":
      return s.durations.plan_min * 60;
    case "work":
      return s.durations.work_min * 60;
    case "reflect":
      return s.durations.reflect_min * 60;
    case "done":
      return 0;
  }
}

/** Seconds left in the current phase (never negative). */
export function remainingSec(s: ActiveSession, now: Date = new Date()): number {
  const started = phaseStartedAt(s);
  if (!started) return phaseDurationSec(s);
  const elapsed = (now.getTime() - new Date(started).getTime()) / 1000;
  return Math.max(0, Math.round(phaseDurationSec(s) - elapsed));
}

/** Has the current phase's countdown expired? */
export function isPhaseExpired(s: ActiveSession, now: Date = new Date()): boolean {
  return s.phase !== "done" && remainingSec(s, now) <= 0;
}

export function toWork(s: ActiveSession, now: Date = new Date()): ActiveSession {
  return { ...s, phase: "work", workStartedAt: now.toISOString() };
}

export function toReflect(s: ActiveSession, now: Date = new Date()): ActiveSession {
  return { ...s, phase: "reflect", reflectStartedAt: now.toISOString() };
}

export function finish(
  s: ActiveSession,
  outcome: FocusOutcome,
  now: Date = new Date(),
): ActiveSession {
  return { ...s, phase: "done", outcome, endedAt: now.toISOString() };
}

/** Advance one phase forward (plan→work→reflect→done). */
export function advance(s: ActiveSession, now: Date = new Date()): ActiveSession {
  switch (s.phase) {
    case "plan":
      return toWork(s, now);
    case "work":
      return toReflect(s, now);
    case "reflect":
      return finish(s, "completed", now);
    case "done":
      return s;
  }
}

/** The domains actually enforced = profile.blocked minus this session's allows. */
export function effectiveBlocked(profile: FocusProfile, overrides: string[]): string[] {
  const allow = new Set(overrides);
  return profile.blocked.filter((d) => !allow.has(d));
}

/** Actual elapsed minutes per phase (for the session log). */
export function actualDurations(s: ActiveSession): {
  plan_min: number;
  work_min: number;
  reflect_min: number;
  total_min: number;
} {
  const mins = (from: string | null, to: string | null): number => {
    if (!from || !to) return 0;
    return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  };
  const plan = mins(s.planStartedAt, s.workStartedAt);
  const work = mins(s.workStartedAt, s.reflectStartedAt ?? s.endedAt);
  const reflect = mins(s.reflectStartedAt, s.endedAt);
  return { plan_min: plan, work_min: work, reflect_min: reflect, total_min: plan + work + reflect };
}

// ── Persistence ────────────────────────────────────────────────────────────

export function loadSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ActiveSession;
    if (!s || s.phase === "done" || !s.id) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: ActiveSession | null): void {
  try {
    if (!s || s.phase === "done") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // storage disabled — running session simply won't survive a refresh
  }
}
