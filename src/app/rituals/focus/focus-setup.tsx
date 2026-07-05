/**
 * FocusSetup (Ch12) — the idle screen. Pick a target, length, optional blocking
 * profile, and a one-line plan, then start. Blocking is opt-in: no profile = a
 * pure standalone timer; a profile engages Arel Focus site-blocking during Work.
 */

import { Section } from "@/app/rituals/check-in-kit";
import { type TargetOption, TargetPicker } from "@/app/rituals/focus/target-picker";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  DEFAULT_DURATIONS,
  FOCUS_PRESETS,
  FOCUS_PROFILES,
  type FocusDurations,
  type FocusProfile,
  type FocusTarget,
  totalMinutes,
} from "@/shared/lib/focus/contract";
import { cn } from "@/shared/lib/utils";
import { Ban, Clock, Play, Shield } from "lucide-react";
import { useState } from "react";

interface FocusSetupProps {
  candidates: TargetOption[];
  onStart: (input: {
    target: FocusTarget;
    profileId: string | null;
    durations: FocusDurations;
    planNotes: string;
  }) => void;
}

export function FocusSetup({ candidates, onStart }: FocusSetupProps) {
  const [target, setTarget] = useState<FocusTarget | null>(null);
  const [durations, setDurations] = useState<FocusDurations>(DEFAULT_DURATIONS);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [planNotes, setPlanNotes] = useState("");

  const setPhase = (key: keyof FocusDurations, value: number) =>
    setDurations((d) => ({ ...d, [key]: Math.max(0, Math.min(600, value || 0)) }));

  const activePreset = FOCUS_PRESETS.find(
    (p) =>
      p.durations.plan_min === durations.plan_min &&
      p.durations.work_min === durations.work_min &&
      p.durations.reflect_min === durations.reflect_min,
  );

  return (
    <div className="space-y-6">
      <Section title="What are you working on">
        <div className="p-4">
          <TargetPicker
            candidates={candidates}
            selected={target}
            onSelect={(t) => setTarget({ slug: t.slug, kind: t.kind, title: t.title })}
          />
        </div>
      </Section>

      <Section title="Length">
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {FOCUS_PRESETS.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant={activePreset?.id === p.id ? "default" : "outline"}
                size="sm"
                onClick={() => setDurations(p.durations)}
              >
                {p.label}
              </Button>
            ))}
            <span className="ml-auto flex items-center gap-1.5 text-caption text-muted-foreground">
              <Clock className="size-3.5" />
              <span className="tabular-nums">{totalMinutes(durations)} min total</span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <PhaseField
              label="Plan"
              value={durations.plan_min}
              onChange={(v) => setPhase("plan_min", v)}
            />
            <PhaseField
              label="Work"
              value={durations.work_min}
              onChange={(v) => setPhase("work_min", v)}
            />
            <PhaseField
              label="Reflect"
              value={durations.reflect_min}
              onChange={(v) => setPhase("reflect_min", v)}
            />
          </div>
        </div>
      </Section>

      <Section title="Blocking">
        <div className="space-y-2.5 p-4">
          <p className="text-caption text-muted-foreground">
            Pick a profile to block distracting sites during Work via Arel Focus. Leave it off for a
            pure timer.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ProfileTile
              active={profileId === null}
              onClick={() => setProfileId(null)}
              icon={Ban}
              label="No blocking"
              blurb="Just the timer — nothing is blocked."
            />
            {FOCUS_PROFILES.map((p) => (
              <ProfileTile
                key={p.id}
                active={profileId === p.id}
                onClick={() => setProfileId(p.id)}
                icon={Shield}
                label={p.label}
                blurb={p.blurb}
              />
            ))}
          </div>
          {profileId && <BlockPreview profile={FOCUS_PROFILES.find((p) => p.id === profileId)} />}
        </div>
      </Section>

      <Section title="Plan">
        <div className="p-4">
          <Textarea
            value={planNotes}
            onChange={(e) => setPlanNotes(e.target.value)}
            placeholder="What does a good session look like? One or two lines."
            className="min-h-20 resize-none"
          />
        </div>
      </Section>

      <div className="flex justify-end">
        <Button
          size="lg"
          disabled={!target}
          onClick={() =>
            target && onStart({ target, profileId, durations, planNotes: planNotes.trim() })
          }
        >
          <Play className="size-4" />
          Start focus
        </Button>
      </div>
    </div>
  );
}

function PhaseField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const id = `phase-${label.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          type="number"
          min={0}
          max={600}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-9 tabular-nums"
        />
        <span className="text-caption text-muted-foreground">min</span>
      </div>
    </div>
  );
}

function ProfileTile({
  active,
  onClick,
  icon: Icon,
  label,
  blurb,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Shield;
  label: string;
  blurb: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors duration-fast",
        active
          ? "border-foreground/25 bg-accent text-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-hover hover:text-foreground",
      )}
    >
      <span className="flex items-center gap-1.5 text-body font-medium text-foreground">
        <Icon className="size-4" />
        {label}
      </span>
      <span className="text-caption">{blurb}</span>
    </button>
  );
}

function BlockPreview({ profile }: { profile: FocusProfile | undefined }) {
  if (!profile) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      <span className="text-caption text-muted-foreground">Blocks</span>
      {profile.blocked.slice(0, 8).map((d) => (
        <Badge key={d} variant="secondary" className="font-normal">
          {d}
        </Badge>
      ))}
      {profile.blocked.length > 8 && (
        <span className="text-caption text-muted-foreground">
          +{profile.blocked.length - 8} more
        </span>
      )}
    </div>
  );
}
