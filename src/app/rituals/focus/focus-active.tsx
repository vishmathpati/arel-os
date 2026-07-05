/**
 * FocusActive (Ch12) — the running session: a drift-safe countdown, the Plan →
 * Work → Reflect rail, and phase-specific controls. During Work with a profile
 * on, the blocked sites show with a per-session "allow" toggle (X and Reddit are
 * useful sometimes — flip them on without abandoning the whole profile).
 */

import { Section } from "@/app/rituals/check-in-kit";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { areaColor } from "@/shared/lib/areas";
import { formatClock, getFocusProfile } from "@/shared/lib/focus/contract";
import {
  type ActiveSession,
  type SessionPhase,
  phaseDurationSec,
} from "@/shared/lib/focus/session";
import type { Connection } from "@/shared/lib/focus/use-focus-session";
import { cn } from "@/shared/lib/utils";
import { LifeBuoy, Play, ShieldCheck, ShieldOff, SkipForward, Square, X } from "lucide-react";

const PHASE_META: Record<Exclude<SessionPhase, "done">, { label: string; tagline: string }> = {
  plan: { label: "Plan", tagline: "Line up the session. Start work whenever you're ready." },
  work: { label: "Work", tagline: "Heads down. This is the block that counts." },
  reflect: { label: "Reflect", tagline: "What happened? Capture it before you move on." },
};

const RAIL: Exclude<SessionPhase, "done">[] = ["plan", "work", "reflect"];

interface FocusActiveProps {
  session: ActiveSession;
  remaining: number;
  connection: Connection;
  blocked: string[];
  onStartWork: () => void;
  onEndWork: () => void;
  onFinish: () => void;
  onCancel: () => void;
  onRescue: () => void;
  onToggleAllow: (domain: string) => void;
  onReflectionChange: (patch: Partial<ActiveSession["reflection"]>) => void;
}

export function FocusActive(props: FocusActiveProps) {
  const { session, remaining, connection, blocked } = props;
  const phase = session.phase as Exclude<SessionPhase, "done">;
  const meta = PHASE_META[phase];
  const total = phaseDurationSec(session);
  const pct = total > 0 ? ((total - remaining) / total) * 100 : 0;
  const profile = getFocusProfile(session.profileId);

  return (
    <div className="space-y-6">
      {/* Target + connection */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: areaColor(session.target.slug) ?? "var(--color-primary)" }}
          />
          <span className="text-subheading font-medium">{session.target.title}</span>
        </div>
        {profile && <ConnectionPill connection={connection} profileLabel={profile.label} />}
      </div>

      {/* Phase rail */}
      <div className="grid grid-cols-3 gap-2">
        {RAIL.map((p) => {
          const idx = RAIL.indexOf(p);
          const cur = RAIL.indexOf(phase);
          const state = idx < cur ? "done" : idx === cur ? "current" : "upcoming";
          return (
            <div
              key={p}
              className={cn(
                "flex flex-col gap-1 rounded-lg border px-3 py-2",
                state === "current" ? "border-foreground/25 bg-accent" : "border-border bg-card",
                state === "upcoming" && "opacity-50",
              )}
            >
              <span className="text-caption uppercase tracking-wide text-muted-foreground">
                {PHASE_META[p].label}
              </span>
              <span className="text-body tabular-nums text-foreground">
                {session.durations[`${p}_min` as const]}m
              </span>
            </div>
          );
        })}
      </div>

      {/* Countdown */}
      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-muted/20 px-6 py-10">
        <span className="text-caption uppercase tracking-wide text-muted-foreground">
          {meta.label}
        </span>
        <span className="text-display font-semibold tabular-nums">{formatClock(remaining)}</span>
        <Progress value={pct} className="h-1.5 w-full max-w-md" />
        <p className="max-w-md text-center text-body text-muted-foreground">{meta.tagline}</p>

        {phase === "plan" && (
          <Button size="lg" onClick={props.onStartWork}>
            <Play className="size-4" />
            Start work now
          </Button>
        )}
        {phase === "work" && (
          <Button size="lg" variant="outline" onClick={props.onEndWork}>
            <SkipForward className="size-4" />
            End work early
          </Button>
        )}
        {phase === "reflect" && (
          <Button size="lg" onClick={props.onFinish}>
            <Square className="size-4" />
            Finish session
          </Button>
        )}
      </div>

      {/* Plan notes during plan */}
      {phase === "plan" && session.planNotes && (
        <Section title="Your plan">
          <p className="whitespace-pre-wrap px-4 py-3.5 text-body">{session.planNotes}</p>
        </Section>
      )}

      {/* Blocked sites + temp-allow during work */}
      {phase === "work" && profile && (
        <Section title="Blocked sites">
          {blocked.length === 0 && session.allowedOverrides.length === 0 ? (
            <p className="px-4 py-3.5 text-body text-muted-foreground">
              Nothing blocked for this profile.
            </p>
          ) : (
            <>
              {blocked.map((d) => (
                <AllowRow
                  key={d}
                  domain={d}
                  allowed={false}
                  onToggle={() => props.onToggleAllow(d)}
                />
              ))}
              {session.allowedOverrides.map((d) => (
                <AllowRow key={d} domain={d} allowed onToggle={() => props.onToggleAllow(d)} />
              ))}
            </>
          )}
        </Section>
      )}

      {/* Reflection during reflect */}
      {phase === "reflect" && (
        <Section title="Reflection">
          <ReflectField
            label="What got done"
            value={session.reflection.done}
            onChange={(v) => props.onReflectionChange({ done: v })}
          />
          <ReflectField
            label="What's unfinished"
            value={session.reflection.unfinished}
            onChange={(v) => props.onReflectionChange({ unfinished: v })}
          />
          <ReflectField
            label="What's next"
            value={session.reflection.next}
            onChange={(v) => props.onReflectionChange({ next: v })}
          />
        </Section>
      )}

      {/* Footer controls */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-error"
          onClick={props.onCancel}
        >
          <X className="size-4" />
          Discard session
        </Button>
        {profile && phase === "work" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={props.onRescue}
          >
            <LifeBuoy className="size-4" />
            Rescue (unblock & end)
          </Button>
        )}
      </div>
    </div>
  );
}

function ConnectionPill({
  connection,
  profileLabel,
}: {
  connection: Connection;
  profileLabel: string;
}) {
  const connected = connection === "connected";
  const Icon = connected ? ShieldCheck : ShieldOff;
  return (
    <span
      className={cn(
        "ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1 text-caption",
        connected
          ? "border-success/40 bg-success/5 text-success"
          : "border-border bg-card text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {profileLabel}
      <span className="text-muted-foreground">
        · {connection === "unknown" ? "checking…" : connected ? "blocking" : "app not running"}
      </span>
    </span>
  );
}

function AllowRow({
  domain,
  allowed,
  onToggle,
}: {
  domain: string;
  allowed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className={cn("text-body", allowed && "text-muted-foreground line-through")}>
        {domain}
      </span>
      <span className="flex items-center gap-2 text-caption text-muted-foreground">
        {allowed ? "Allowed" : "Blocked"}
        <Switch checked={allowed} onCheckedChange={onToggle} aria-label={`Allow ${domain}`} />
      </span>
    </div>
  );
}

function ReflectField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 px-4 py-3.5">
      <span className="text-body">{label}</span>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…"
        className="min-h-16 resize-none"
      />
    </div>
  );
}
