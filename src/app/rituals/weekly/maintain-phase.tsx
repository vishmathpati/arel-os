/**
 * Maintain phase (Ch13 / D39) — four sub-tools that act on the vault directly
 * (nothing stored on the weekly note). Re-homing queue (demoted projects →
 * re-attach to a quest or keep standalone), quest deadline review (overdue →
 * Done / Roll / Drop), stale-task triage (overdue tasks → reschedule / drop /
 * done), and an inbox catch (count + link). Pure presentation — mutations in.
 */

import { Section } from "@/app/rituals/check-in-kit";
import { TypeIcon } from "@/shared/components/type-icon";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { areaColor, areaSlug } from "@/shared/lib/areas";
import type { Project } from "@/shared/lib/project-data";
import type { Quest } from "@/shared/lib/quest-data";
import type { SchedulePick } from "@/shared/lib/tasks/schedule";
import { formatSchedule } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { ArrowRight, CalendarClock, Inbox, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";

interface MaintainPhaseProps {
  rehoming: Project[];
  activeQuests: Quest[];
  overdueQuests: Quest[];
  staleTasks: Task[];
  inboxCount: number;
  onAttachQuest: (project: Project, questSlug: string) => void;
  onKeepStandalone: (project: Project) => void;
  onQuestDone: (quest: Quest) => void;
  onQuestRoll: (quest: Quest, newDeadline: string) => void;
  onQuestDrop: (quest: Quest) => void;
  onRescheduleTask: (task: Task, pick: SchedulePick) => void;
  onDropTask: (task: Task) => void;
  onCompleteTask: (task: Task) => void;
}

const deadlineLabel = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** YYYY-MM-DD a number of days from today (local). */
const fromToday = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const AreaDot = ({ area }: { area: string | null }) =>
  area ? (
    <span
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: areaColor(area) ?? "#5F5F5F" }}
    />
  ) : null;

export function MaintainPhase(props: MaintainPhaseProps) {
  const {
    rehoming,
    activeQuests,
    overdueQuests,
    staleTasks,
    inboxCount,
    onAttachQuest,
    onKeepStandalone,
    onQuestDone,
    onQuestRoll,
    onQuestDrop,
    onRescheduleTask,
    onDropTask,
    onCompleteTask,
  } = props;

  return (
    <div className="space-y-6">
      {/* 1 — re-homing queue */}
      <Section title={`Re-home projects${rehoming.length ? ` · ${rehoming.length}` : ""}`}>
        {rehoming.length === 0 ? (
          <p className="px-4 py-3.5 text-body text-muted-foreground">
            No orphaned projects. Projects from ended quests would land here.
          </p>
        ) : (
          rehoming.map((project) => (
            <div key={project.path} className="flex items-center gap-3 px-4 py-2.5">
              <TypeIcon type="project" />
              <span className="min-w-0 flex-1 truncate text-body">
                {project.title || "Untitled project"}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-caption text-muted-foreground">
                <AreaDot area={areaSlug(project.area)} />
                {areaSlug(project.area)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <AttachQuestPicker
                  quests={activeQuests}
                  onPick={(q) => onAttachQuest(project, q.slug)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-caption text-muted-foreground"
                  onClick={() => onKeepStandalone(project)}
                >
                  Keep standalone
                </Button>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* 2 — quest deadline review */}
      <Section title={`Overdue quests${overdueQuests.length ? ` · ${overdueQuests.length}` : ""}`}>
        {overdueQuests.length === 0 ? (
          <p className="px-4 py-3.5 text-body text-muted-foreground">
            No quests past their deadline. Nicely kept.
          </p>
        ) : (
          overdueQuests.map((quest) => (
            <div key={quest.path} className="flex items-center gap-3 px-4 py-2.5">
              <TypeIcon type="quest" />
              <span className="min-w-0 flex-1 truncate text-body">
                {quest.title || "Untitled quest"}
              </span>
              <span className="shrink-0 text-caption text-error">
                Due {deadlineLabel(quest.deadline)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-caption text-muted-foreground hover:text-success"
                  onClick={() => onQuestDone(quest)}
                >
                  Done
                </Button>
                <RollPicker onRoll={(deadline) => onQuestRoll(quest, deadline)} />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-caption text-muted-foreground hover:text-error"
                  onClick={() => onQuestDrop(quest)}
                >
                  Drop
                </Button>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* 3 — stale-task triage */}
      <Section title={`Stale tasks${staleTasks.length ? ` · ${staleTasks.length}` : ""}`}>
        {staleTasks.length === 0 ? (
          <p className="px-4 py-3.5 text-body text-success">
            No overdue tasks — your list is current.
          </p>
        ) : (
          staleTasks.map((task) => (
            <div key={task.path} className="flex items-center gap-3 px-4 py-2.5">
              <Checkbox
                checked={false}
                onCheckedChange={() => onCompleteTask(task)}
                aria-label="Mark done"
              />
              <span className="min-w-0 flex-1 truncate text-body">{task.title || "Untitled"}</span>
              <span className="shrink-0 text-caption text-error">
                {formatSchedule(task.schedule)}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-caption text-muted-foreground"
                  onClick={() => onRescheduleTask(task, "this-week")}
                >
                  This week
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-caption text-muted-foreground"
                  onClick={() => onRescheduleTask(task, "someday")}
                >
                  Someday
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-caption text-muted-foreground hover:text-error"
                  onClick={() => onDropTask(task)}
                >
                  Drop
                </Button>
              </div>
            </div>
          ))
        )}
      </Section>

      {/* 4 — inbox catch */}
      <Section title="Inbox">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Inbox className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 text-body">
            {inboxCount === 0
              ? "Inbox is at zero — nothing to catch."
              : `${inboxCount} item${inboxCount === 1 ? "" : "s"} waiting to be filed.`}
          </span>
          {inboxCount > 0 && (
            <Button asChild variant="outline" size="sm" className="h-7 gap-1">
              <Link to="/inbox">
                Open Inbox
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </Section>
    </div>
  );
}

function AttachQuestPicker({
  quests,
  onPick,
}: {
  quests: Quest[];
  onPick: (quest: Quest) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-caption"
          disabled={!quests.length}
        >
          <ListChecks className="size-3.5" />
          Attach to quest
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command>
          <CommandInput placeholder="Pick a quest…" />
          <CommandList>
            <CommandEmpty>No active quests.</CommandEmpty>
            <CommandGroup>
              {quests.map((q) => (
                <CommandItem key={q.path} value={q.title ?? q.slug} onSelect={() => onPick(q)}>
                  <TypeIcon type="quest" className="size-3.5" />
                  <span className="truncate">{q.title || q.slug}</span>
                  <AreaDot area={areaSlug(q.area)} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const ROLL_PRESETS: ReadonlyArray<{ label: string; days: number }> = [
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
];

function RollPicker({ onRoll }: { onRoll: (deadline: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-caption text-muted-foreground hover:text-info"
        >
          <CalendarClock className="size-3.5" />
          Roll
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="end">
        <p className="px-1 pb-1.5 text-caption text-muted-foreground">Extend deadline by</p>
        <div className="flex flex-col gap-0.5">
          {ROLL_PRESETS.map((p) => (
            <Button
              key={p.days}
              variant="ghost"
              size="sm"
              className="h-8 justify-start text-body"
              onClick={() => onRoll(fromToday(p.days))}
            >
              {p.label}
              <Badge variant="secondary" className="ml-auto font-normal">
                {deadlineLabel(fromToday(p.days))}
              </Badge>
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
