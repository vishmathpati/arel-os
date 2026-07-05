/**
 * FocusComplete (Ch12) — the after-session summary. Shows what was worked on, how
 * the time actually broke down, the reflection, and confirms the session was
 * logged to today's daily note. Connected-session telemetry (apps/sites/blocked
 * attempts) lives in the logged entry; here we keep the close calm and brief.
 */

import { Section } from "@/app/rituals/check-in-kit";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { type FocusSessionResult, getFocusProfile } from "@/shared/lib/focus/contract";
import { type ActiveSession, actualDurations } from "@/shared/lib/focus/session";
import { CheckCircle2, Globe, RotateCcw, ShieldX, XCircle } from "lucide-react";
import type { ReactNode } from "react";

const OUTCOME: Record<
  NonNullable<ActiveSession["outcome"]>,
  { label: string; tone: "ok" | "muted" }
> = {
  completed: { label: "Completed", tone: "ok" },
  cancelled: { label: "Discarded", tone: "muted" },
  rescued: { label: "Rescued", tone: "muted" },
};

export function FocusComplete({
  session,
  result,
  onNew,
}: {
  session: ActiveSession;
  /** Arel Focus telemetry for a connected session (null when standalone/absent). */
  result?: FocusSessionResult | null;
  onNew: () => void;
}) {
  const actual = actualDurations(session);
  const profile = getFocusProfile(session.profileId);
  const outcome = OUTCOME[session.outcome ?? "completed"];
  const ok = outcome.tone === "ok";
  const refl = session.reflection;
  const hasReflection = refl.done || refl.unfinished || refl.next;
  const work = result?.work;
  const hasTelemetry =
    work &&
    (work.blocked_site_attempts.length || work.websites_used.length || work.apps_used.length);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/20 px-6 py-5">
        {ok ? (
          <CheckCircle2 className="size-6 text-success" />
        ) : (
          <XCircle className="size-6 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-subheading font-medium">{ok ? "Session complete" : outcome.label}</p>
          <p className="text-caption text-muted-foreground">
            {session.target.title}
            {profile && ` · ${profile.label}`}
          </p>
        </div>
        <span className="text-heading font-semibold tabular-nums">{actual.total_min}m</span>
      </div>

      <Section title="Time">
        <Stat label="Plan" value={`${actual.plan_min}m`} />
        <Stat label="Work" value={`${actual.work_min}m`} />
        <Stat label="Reflect" value={`${actual.reflect_min}m`} />
        <Stat label="Outcome" value={outcome.label} />
        {session.allowedOverrides.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
            <span className="text-body text-muted-foreground">Allowed mid-session</span>
            {session.allowedOverrides.map((d) => (
              <Badge key={d} variant="secondary" className="font-normal">
                {d}
              </Badge>
            ))}
          </div>
        )}
      </Section>

      {hasTelemetry && work && (
        <Section title="While you worked">
          {work.blocked_site_attempts.length > 0 && (
            <ChipRow
              icon={<ShieldX className="size-3.5 text-error" />}
              label="Blocked attempts"
              items={work.blocked_site_attempts}
            />
          )}
          {work.websites_used.length > 0 && (
            <ChipRow
              icon={<Globe className="size-3.5 text-muted-foreground" />}
              label="Sites visited"
              items={work.websites_used}
            />
          )}
          {work.apps_used.length > 0 && <ChipRow label="Apps used" items={work.apps_used} />}
        </Section>
      )}

      {hasReflection && (
        <Section title="Reflection">
          {refl.done && <Note label="Done" text={refl.done} />}
          {refl.unfinished && <Note label="Unfinished" text={refl.unfinished} />}
          {refl.next && <Note label="Next" text={refl.next} />}
        </Section>
      )}

      <div className="flex items-center justify-between">
        <p className="text-caption text-muted-foreground">Logged to today's note.</p>
        <Button onClick={onNew}>
          <RotateCcw className="size-4" />
          New session
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-body text-muted-foreground">{label}</span>
      <span className="text-body tabular-nums">{value}</span>
    </div>
  );
}

function ChipRow({
  icon,
  label,
  items,
}: {
  icon?: ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <div className="space-y-1.5 px-4 py-3">
      <span className="flex items-center gap-1.5 text-caption uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((d) => (
          <Badge key={d} variant="secondary" className="font-normal">
            {d}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="space-y-1 px-4 py-3">
      <span className="text-caption uppercase tracking-wide text-muted-foreground">{label}</span>
      <p className="whitespace-pre-wrap text-body">{text}</p>
    </div>
  );
}
