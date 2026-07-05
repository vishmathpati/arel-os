/**
 * Reflect phase (Ch13 / D39) — the backward look. Recap each focus quest with
 * inline milestone toggles, then capture the week's wins and learnings as free
 * text. Wins/learnings persist to the weekly note (string[] split by line);
 * milestone toggles write the quest directly. Pure presentation — mutations in.
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { Block, Section } from "@/app/rituals/check-in-kit";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Textarea } from "@/shared/components/ui/textarea";
import { areaSlug } from "@/shared/lib/areas";
import type { Quest } from "@/shared/lib/quest-data";
import { cn } from "@/shared/lib/utils";
import { Lightbulb, Sparkles, Target } from "lucide-react";

interface ReflectPhaseProps {
  focusQuests: Quest[];
  wins: string[];
  learnings: string[];
  onToggleMilestone: (quest: Quest, index: number) => void;
  onChange: (patch: { wins?: string[]; learnings?: string[] }) => void;
}

const deadlineLabel = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export function ReflectPhase({
  focusQuests,
  wins,
  learnings,
  onToggleMilestone,
  onChange,
}: ReflectPhaseProps) {
  const { colorOf } = useAreasContext();
  return (
    <div className="space-y-6">
      <Section title="This week's focus quests">
        {focusQuests.length === 0 ? (
          <p className="px-4 py-3.5 text-body text-muted-foreground">
            No focus quests were set for this week. Pick up to three in the Plan phase.
          </p>
        ) : (
          focusQuests.map((quest) => {
            const slug = areaSlug(quest.area);
            const milestones = quest.milestones ?? [];
            const reached = milestones.filter((m) => m.reached).length;
            return (
              <Block key={quest.path} icon={Target} label={quest.title || "Untitled quest"}>
                <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
                  {slug && (
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: colorOf(slug) ?? "#5F5F5F" }}
                      />
                      {slug}
                    </span>
                  )}
                  <span>Due {deadlineLabel(quest.deadline)}</span>
                  {milestones.length > 0 && (
                    <span className="tabular-nums">
                      {reached}/{milestones.length} milestones
                    </span>
                  )}
                </div>
                {milestones.length > 0 && (
                  <div className="mt-1 space-y-1.5">
                    {milestones.map((m, i) => (
                      <div
                        key={`${quest.slug}-${i}`}
                        className="flex items-center gap-2.5 text-body"
                      >
                        <Checkbox
                          checked={m.reached}
                          onCheckedChange={() => onToggleMilestone(quest, i)}
                          aria-label={m.title}
                        />
                        <span className={cn(m.reached && "text-muted-foreground line-through")}>
                          {m.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Block>
            );
          })
        )}
      </Section>

      <Section title="Wins & learnings">
        <Block icon={Sparkles} label="Wins this week">
          <Textarea
            value={wins.join("\n")}
            onChange={(e) =>
              onChange({ wins: e.target.value ? e.target.value.split("\n") : undefined })
            }
            placeholder="What went well? One per line…"
            className="min-h-20 resize-none"
          />
        </Block>
        <Block icon={Lightbulb} label="Mistakes & learnings">
          <Textarea
            value={learnings.join("\n")}
            onChange={(e) =>
              onChange({ learnings: e.target.value ? e.target.value.split("\n") : undefined })
            }
            placeholder="What would you do differently? One per line…"
            className="min-h-20 resize-none"
          />
        </Block>
      </Section>
    </div>
  );
}
