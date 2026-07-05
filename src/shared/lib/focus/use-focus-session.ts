/**
 * useFocusSession (Ch12) — the React orchestration layer over the pure session
 * engine. Owns the live ticking clock, fires Arel Focus bridge commands on phase
 * transitions (only when a profile is selected — standalone never contacts it),
 * recovers a running session after a refresh, and logs the finished session to
 * today's daily note.
 */

import { appendSession } from "@/shared/lib/daily";
import { fetchResult, fetchState, sendCommand } from "@/shared/lib/focus/bridge-client";
import {
  type FocusDurations,
  type FocusProfile,
  type FocusSessionResult,
  type FocusTarget,
  buildStartCommand,
  createSessionId,
  getFocusProfile,
} from "@/shared/lib/focus/contract";
import {
  type ActiveSession,
  actualDurations,
  advance,
  effectiveBlocked,
  finish as finishSession,
  isPhaseExpired,
  loadSession,
  remainingSec,
  saveSession,
  startSession,
  toReflect,
  toWork,
} from "@/shared/lib/focus/session";
import type { FocusLog } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useRef, useState } from "react";

export type Connection = "unknown" | "connected" | "absent";

export interface UseFocusSession {
  session: ActiveSession | null;
  remaining: number;
  connection: Connection;
  /** Domains currently enforced (profile.blocked minus session allows). */
  blocked: string[];
  /** Arel Focus telemetry for the finished connected session (null otherwise). */
  result: FocusSessionResult | null;
  start: (input: {
    target: FocusTarget;
    profileId: string | null;
    durations: FocusDurations;
    planNotes: string;
  }) => void;
  startWork: () => void;
  endWork: () => void;
  finishReflect: () => void;
  cancel: () => void;
  rescue: () => void;
  toggleAllow: (domain: string) => void;
  setReflection: (patch: Partial<ActiveSession["reflection"]>) => void;
  reset: () => void;
}

export function useFocusSession(): UseFocusSession {
  const [session, setSession] = useState<ActiveSession | null>(() => loadSession());
  const [, setTick] = useState(0);
  const [connection, setConnection] = useState<Connection>("unknown");
  const [result, setResult] = useState<FocusSessionResult | null>(null);

  // Latest session for use inside intervals/callbacks without stale closures.
  const ref = useRef<ActiveSession | null>(session);
  ref.current = session;

  const profileOf = (s: ActiveSession): FocusProfile | null => getFocusProfile(s.profileId);

  /** Commit a new session state: persist + fire transition side-effects. */
  const commit = useCallback((prev: ActiveSession | null, next: ActiveSession) => {
    saveSession(next);
    setSession(next);

    // plan → work: engage blocking (connected only).
    if (prev && prev.phase !== "work" && next.phase === "work" && next.profileId) {
      const profile = getFocusProfile(next.profileId);
      if (profile && next.workStartedAt) {
        const blocked = effectiveBlocked(profile, next.allowedOverrides);
        void sendCommand(
          buildStartCommand({
            sessionId: next.id,
            target: next.target,
            profile: { ...profile, blocked },
            durations: { plan_min: 0, work_min: next.durations.work_min, reflect_min: 0 },
            planNotes: next.planNotes,
            startAt: next.workStartedAt,
          }),
        );
      }
    }

    // leaving work (reflect/done) without rescue: unblock.
    if (
      prev &&
      prev.phase === "work" &&
      next.phase !== "work" &&
      prev.profileId &&
      !next.rescue.used
    ) {
      void sendCommand({
        schema_version: "arel-focus-hour.v2",
        command: "cancel_focus_hour",
        session_id: next.id,
        requested_at: new Date().toISOString(),
        requested_by: "arel-os",
      });
    }
  }, []);

  /** Log a finished session to the daily note, enriched from Arel Focus if present. */
  const logFinished = useCallback(async (s: ActiveSession) => {
    const hasReflection = s.reflection.done || s.reflection.unfinished || s.reflection.next;
    const log: FocusLog = {
      id: s.id,
      target: s.target,
      profile_id: s.profileId ?? undefined,
      planned: { ...s.durations },
      actual: actualDurations(s),
      plan_notes: s.planNotes || undefined,
      reflection: hasReflection
        ? {
            done: s.reflection.done || undefined,
            unfinished: s.reflection.unfinished || undefined,
            next: s.reflection.next || undefined,
          }
        : undefined,
      outcome: s.outcome ?? "completed",
      started_at: s.planStartedAt ?? new Date().toISOString(),
      ended_at: s.endedAt ?? new Date().toISOString(),
    };

    // Connected sessions: pull work telemetry from the Arel Focus result file.
    if (s.profileId) {
      const result = await fetchResult(s.id);
      if (result) {
        setResult(result);
        log.apps_used = result.work.apps_used;
        log.websites_used = result.work.websites_used;
        log.blocked_site_attempts = result.work.blocked_site_attempts;
        log.allowed_overrides = result.allowed_overrides;
      } else if (s.allowedOverrides.length) {
        log.allowed_overrides = s.allowedOverrides;
      }
    }

    try {
      await appendSession(log);
    } catch {
      // vault server down — the session still completed locally
    }
  }, []);

  // ── Live clock: tick every second, auto-advance expired phases ──────────────
  useEffect(() => {
    if (!session || session.phase === "done") return;
    const id = setInterval(() => {
      const s = ref.current;
      if (!s || s.phase === "done") return;
      if (isPhaseExpired(s)) commit(s, advance(s));
      else setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [session, commit]);

  // ── On finish, log to the daily note exactly once ───────────────────────────
  const loggedRef = useRef<string | null>(null);
  useEffect(() => {
    if (session?.phase === "done" && session.outcome && loggedRef.current !== session.id) {
      loggedRef.current = session.id;
      void logFinished(session);
    }
  }, [session, logFinished]);

  // ── Connection indicator: poll Arel Focus state lightly while connected ─────
  useEffect(() => {
    if (!session || session.phase === "done" || !session.profileId) return;
    let alive = true;
    const probe = async () => {
      const state = await fetchState();
      if (alive) setConnection(state ? "connected" : "absent");
    };
    void probe();
    const id = setInterval(probe, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [session]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const start = useCallback<UseFocusSession["start"]>(
    (input) => {
      const next = startSession({ id: createSessionId(), ...input });
      commit(null, next);
    },
    [commit],
  );

  const startWork = useCallback(() => {
    const s = ref.current;
    if (s?.phase === "plan") commit(s, toWork(s));
  }, [commit]);

  const endWork = useCallback(() => {
    const s = ref.current;
    if (s?.phase === "work") commit(s, toReflect(s));
  }, [commit]);

  const finishReflect = useCallback(() => {
    const s = ref.current;
    if (s?.phase === "reflect") commit(s, finishSession(s, "completed"));
  }, [commit]);

  const cancel = useCallback(() => {
    const s = ref.current;
    if (!s || s.phase === "done") return;
    commit(s, finishSession(s, "cancelled"));
  }, [commit]);

  const rescue = useCallback(() => {
    const s = ref.current;
    if (!s || s.phase === "done") return;
    if (s.profileId) {
      void sendCommand({
        schema_version: "arel-focus-hour.v2",
        command: "rescue_focus_hour",
        session_id: s.id,
        requested_at: new Date().toISOString(),
        requested_by: "arel-os",
      });
    }
    const next: ActiveSession = { ...finishSession(s, "rescued"), rescue: { used: true } };
    commit(s, next);
  }, [commit]);

  const toggleAllow = useCallback((domain: string) => {
    const s = ref.current;
    if (!s || s.phase === "done") return;
    const has = s.allowedOverrides.includes(domain);
    const allowedOverrides = has
      ? s.allowedOverrides.filter((d) => d !== domain)
      : [...s.allowedOverrides, domain];
    const next = { ...s, allowedOverrides };
    saveSession(next);
    setSession(next);
    // Push the new effective block list to Arel Focus mid-session.
    if (s.profileId && s.phase === "work") {
      const profile = getFocusProfile(s.profileId);
      if (profile) {
        void sendCommand({
          schema_version: "arel-focus-hour.v2",
          command: "update_focus_hour",
          session_id: s.id,
          blocked: effectiveBlocked(profile, allowedOverrides),
          requested_at: new Date().toISOString(),
          requested_by: "arel-os",
        });
      }
    }
  }, []);

  const setReflection = useCallback((patch: Partial<ActiveSession["reflection"]>) => {
    const s = ref.current;
    if (!s) return;
    const next = { ...s, reflection: { ...s.reflection, ...patch } };
    saveSession(next);
    setSession(next);
  }, []);

  const reset = useCallback(() => {
    saveSession(null);
    setSession(null);
    setConnection("unknown");
    setResult(null);
  }, []);

  const profile = session ? profileOf(session) : null;
  const blocked = profile ? effectiveBlocked(profile, session?.allowedOverrides ?? []) : [];

  return {
    session,
    remaining: session ? remainingSec(session) : 0,
    connection,
    blocked,
    result,
    start,
    startWork,
    endWork,
    finishReflect,
    cancel,
    rescue,
    toggleAllow,
    setReflection,
    reset,
  };
}
