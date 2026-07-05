/**
 * Evening check-in (Ch11 / D35) — the night counterpart to the morning check-in.
 * Same kit + view/edit pattern, backward-looking questions: how the day landed
 * (mood / energy left / did it match this morning's intention) and a short
 * reflection (wins — with a read-only "done today" list — open loops, letting
 * go). Silent debounced autosave via the parent.
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
} from "@/app/rituals/check-in-kit";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import type { DailyEvening, IntentionMatch } from "@/shared/lib/vault/schemas";
import {
  Check,
  CheckCircle2,
  Circle,
  CircleDashed,
  Heart,
  ListChecks,
  type LucideIcon,
  Moon,
  Pencil,
  Smile,
  Sunrise,
  Zap,
} from "lucide-react";
import { useState } from "react";

interface EveningCheckInProps {
  evening: DailyEvening | undefined;
  /** This morning's intention, surfaced for the match question. */
  morningIntention?: string;
  /** Tasks completed today — shown read-only above the wins field. */
  completedToday: Task[];
  onChange: (patch: Partial<DailyEvening>) => void;
}

const MATCHES: ReadonlyArray<{ value: IntentionMatch; icon: LucideIcon; label: string }> = [
  { value: "yes", icon: CheckCircle2, label: "Yes" },
  { value: "partly", icon: CircleDashed, label: "Partly" },
  { value: "no", icon: Circle, label: "No" },
];

function hasAnswers(e: DailyEvening): boolean {
  return (
    e.mood !== undefined ||
    e.energy !== undefined ||
    !!e.intention_match ||
    !!e.wins ||
    !!e.open_loops ||
    !!e.letting_go
  );
}

export function EveningCheckIn({
  evening,
  morningIntention,
  completedToday,
  onChange,
}: EveningCheckInProps) {
  const e = evening ?? {};
  const [mode, setMode] = useState<"view" | "edit">(hasAnswers(e) ? "view" : "edit");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-subheading">
          <Moon className="size-4 text-muted-foreground" />
          Night check-in
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
        <Section title="How the day landed">
          <Row icon={Smile} label="Mood now">
            {mode === "edit" ? (
              <MoodTiles value={e.mood} onChange={(mood) => onChange({ mood })} />
            ) : (
              <MoodValue value={e.mood} />
            )}
          </Row>
          <Row icon={Zap} label="Energy left">
            {mode === "edit" ? (
              <EnergyMeter value={e.energy} onChange={(energy) => onChange({ energy })} />
            ) : e.energy ? (
              <LevelMeter value={e.energy} />
            ) : (
              <NotSet />
            )}
          </Row>
          <Block icon={Sunrise} label="Did today match your intention?">
            <p className="text-caption text-muted-foreground">
              {morningIntention ? (
                <>This morning: “{morningIntention}”</>
              ) : (
                "No morning intention was set."
              )}
            </p>
            {mode === "edit" ? (
              <div className="inline-flex rounded-md border border-border bg-card p-1">
                {MATCHES.map(({ value, icon: Icon, label }) => {
                  const active = e.intention_match === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onChange({ intention_match: active ? undefined : value })}
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
            ) : e.intention_match ? (
              (() => {
                const match = MATCHES.find((x) => x.value === e.intention_match);
                if (!match) return <NotSet />;
                return (
                  <span className="inline-flex items-center gap-1.5 text-body">
                    <match.icon className="size-4 text-muted-foreground" />
                    {match.label}
                  </span>
                );
              })()
            ) : (
              <NotSet />
            )}
          </Block>
        </Section>

        <Section title="Reflect">
          <Block icon={ListChecks} label="Wins">
            {completedToday.length > 0 && (
              <div className="space-y-1 rounded-md border border-border bg-card px-3 py-2">
                <p className="text-caption text-muted-foreground">
                  You finished {completedToday.length} today
                </p>
                {completedToday.slice(0, 6).map((t) => (
                  <p key={t.path} className="flex items-center gap-1.5 text-caption">
                    <Check className="size-3 shrink-0 text-success" />
                    <span className="truncate">{t.title || "Untitled"}</span>
                  </p>
                ))}
              </div>
            )}
            {mode === "edit" ? (
              <Textarea
                value={e.wins ?? ""}
                onChange={(ev) => onChange({ wins: ev.target.value || undefined })}
                placeholder="What went well today…"
                className="min-h-20 resize-none bg-card"
              />
            ) : e.wins ? (
              <p className="whitespace-pre-wrap text-body">{e.wins}</p>
            ) : (
              <NotSet />
            )}
          </Block>
          <Block icon={Moon} label="Open loops">
            {mode === "edit" ? (
              <Textarea
                value={e.open_loops ?? ""}
                onChange={(ev) => onChange({ open_loops: ev.target.value || undefined })}
                placeholder="What's still on your mind…"
                className="min-h-20 resize-none bg-card"
              />
            ) : e.open_loops ? (
              <p className="whitespace-pre-wrap text-body">{e.open_loops}</p>
            ) : (
              <NotSet />
            )}
          </Block>
        </Section>

        <Section title="Close the day">
          <Row icon={Heart} label="Letting go of">
            {mode === "edit" ? (
              <Input
                value={e.letting_go ?? ""}
                onChange={(ev) => onChange({ letting_go: ev.target.value || undefined })}
                placeholder="One thing you're setting down…"
                className="bg-card sm:w-80"
              />
            ) : e.letting_go ? (
              <span className="text-body">{e.letting_go}</span>
            ) : (
              <NotSet />
            )}
          </Row>
        </Section>
      </CardContent>
    </Card>
  );
}
