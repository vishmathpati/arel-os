/**
 * Morning check-in (Ch10 / D34) — the seven fixed morning questions, in two
 * modes. VIEW (the resting state once anything is captured) shows the answers;
 * EDIT opens the controls on demand; a freshly-started note opens in EDIT.
 *
 * Composed from the shared check-in kit (Section/Row/Block + mood/energy), with
 * the morning-only controls here (headspace chips, thought-valence segmented
 * control). Selection reads through bg-accent — no new color, no emoji. Autosave
 * is silent, via the parent's debounced save.
 */

import {
  Block,
  EnergyMeter,
  LevelMeter,
  MoodTiles,
  MoodValue,
  NotSet,
  Row,
  Section,
  cap,
} from "@/app/rituals/check-in-kit";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";
import type { DailyMorning, Headspace, ThoughtValence } from "@/shared/lib/vault/schemas";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Heart,
  type LucideIcon,
  Meh,
  Pencil,
  Smile,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface CheckInProps {
  morning: DailyMorning | undefined;
  onChange: (patch: Partial<DailyMorning>) => void;
}

const HEADSPACES: readonly Headspace[] = [
  "clear",
  "optimistic",
  "neutral",
  "anxious",
  "heavy",
  "scattered",
];

const VALENCES: ReadonlyArray<{ value: ThoughtValence; icon: LucideIcon; label: string }> = [
  { value: "forward", icon: ArrowUpRight, label: "Pulling forward" },
  { value: "mixed", icon: ArrowRight, label: "Mixed" },
  { value: "holding", icon: ArrowDownRight, label: "Holding back" },
];

function hasAnswers(m: DailyMorning): boolean {
  return (
    m.mood !== undefined ||
    m.energy !== undefined ||
    !!m.headspace ||
    !!m.mind_dump ||
    !!m.thought_valence ||
    !!m.gratitude ||
    !!m.intention
  );
}

export function CheckIn({ morning, onChange }: CheckInProps) {
  const m = morning ?? {};
  const [mode, setMode] = useState<"view" | "edit">(hasAnswers(m) ? "view" : "edit");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-subheading">
          <Sparkles className="size-4 text-muted-foreground" />
          Check-in
        </CardTitle>
        {mode === "view" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-muted-foreground"
            onClick={() => setMode("edit")}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setMode("view")}
          >
            <Check className="size-3.5" />
            Done
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {mode === "view" ? <CheckInView m={m} /> : <CheckInEdit m={m} onChange={onChange} />}
      </CardContent>
    </Card>
  );
}

function CheckInEdit({
  m,
  onChange,
}: {
  m: DailyMorning;
  onChange: (patch: Partial<DailyMorning>) => void;
}) {
  return (
    <>
      <Section title="How you're arriving">
        <Row icon={Smile} label="Mood">
          <MoodTiles value={m.mood} onChange={(mood) => onChange({ mood })} />
        </Row>
        <Row icon={Zap} label="Energy">
          <EnergyMeter value={m.energy} onChange={(energy) => onChange({ energy })} />
        </Row>
        <Row icon={Sparkles} label="Headspace">
          <div className="flex flex-wrap gap-1.5 sm:justify-end">
            {HEADSPACES.map((h) => {
              const active = m.headspace === h;
              return (
                <button
                  key={h}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ headspace: active ? undefined : h })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-caption transition-colors duration-fast",
                    active
                      ? "border-foreground/25 bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:bg-hover hover:text-foreground",
                  )}
                >
                  {cap(h)}
                </button>
              );
            })}
          </div>
        </Row>
      </Section>

      <Section title="What's on your mind">
        <Block icon={Meh} label="The loudest thought">
          <Textarea
            value={m.mind_dump ?? ""}
            onChange={(e) => onChange({ mind_dump: e.target.value || undefined })}
            placeholder="Dump it here…"
            className="min-h-24 resize-none bg-card"
          />
        </Block>
        <Row icon={ArrowUpRight} label="Is that thought…">
          <div className="inline-flex rounded-md border border-border bg-card p-1">
            {VALENCES.map(({ value, icon: Icon, label }) => {
              const active = m.thought_valence === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ thought_valence: active ? undefined : value })}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-caption transition-colors duration-fast",
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
        </Row>
      </Section>

      <Section title="Your tone for today">
        <Row icon={Heart} label="Grateful for">
          <Input
            value={m.gratitude ?? ""}
            onChange={(e) => onChange({ gratitude: e.target.value || undefined })}
            placeholder="One thing…"
            className="bg-card sm:w-80"
          />
        </Row>
        <Row icon={Target} label="Intention for today">
          <Input
            value={m.intention ?? ""}
            onChange={(e) => onChange({ intention: e.target.value || undefined })}
            placeholder="How you want to show up…"
            className="bg-card sm:w-80"
          />
        </Row>
      </Section>
    </>
  );
}

function CheckInView({ m }: { m: DailyMorning }) {
  const valence = VALENCES.find((v) => v.value === m.thought_valence);

  return (
    <>
      <Section title="How you're arriving">
        <Row icon={Smile} label="Mood">
          <MoodValue value={m.mood} />
        </Row>
        <Row icon={Zap} label="Energy">
          {m.energy ? <LevelMeter value={m.energy} /> : <NotSet />}
        </Row>
        <Row icon={Sparkles} label="Headspace">
          {m.headspace ? (
            <span className="rounded-full border border-border bg-accent px-3 py-1 text-caption text-foreground">
              {cap(m.headspace)}
            </span>
          ) : (
            <NotSet />
          )}
        </Row>
      </Section>

      <Section title="What's on your mind">
        <Block icon={Meh} label="The loudest thought">
          {m.mind_dump ? (
            <p className="whitespace-pre-wrap text-body">{m.mind_dump}</p>
          ) : (
            <NotSet />
          )}
        </Block>
        <Row icon={ArrowUpRight} label="Is that thought…">
          {valence ? (
            <span className="inline-flex items-center gap-1.5 text-body">
              <valence.icon className="size-4 text-muted-foreground" />
              {valence.label}
            </span>
          ) : (
            <NotSet />
          )}
        </Row>
      </Section>

      <Section title="Your tone for today">
        <Row icon={Heart} label="Grateful for">
          {m.gratitude ? <span className="text-body">{m.gratitude}</span> : <NotSet />}
        </Row>
        <Row icon={Target} label="Intention for today">
          {m.intention ? <span className="text-body">{m.intention}</span> : <NotSet />}
        </Row>
      </Section>
    </>
  );
}
