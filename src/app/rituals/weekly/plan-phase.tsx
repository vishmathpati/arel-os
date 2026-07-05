/**
 * Plan phase (Ch13 / D39) — the forward look. Pick up to ~3 focus quests
 * (toggles quest.focus + snapshots to the note), then assign work across Mon–Sat
 * (writes each task's `schedule` date, which flows into Morning for free). Any
 * assignment can be marked recurring → it pre-seeds next week's plan (stored on
 * the note's recurring[]). Pure presentation — mutations in.
 */

import { TypeIcon } from "@/shared/components/type-icon";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { areaColor, areaSlug } from "@/shared/lib/areas";
import type { Quest } from "@/shared/lib/quest-data";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import type { WeekDay } from "@/shared/lib/vault/schemas";
import { Plus, Repeat, X } from "lucide-react";

const PLAN_DAYS: readonly WeekDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const DAY_LABEL: Record<WeekDay, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const FOCUS_CAP = 3;

interface PlanPhaseProps {
  focusableQuests: Quest[];
  focusSlugs: ReadonlySet<string>;
  onToggleFocus: (quest: Quest) => void;
  weekDates: Record<WeekDay, string>;
  assignmentsByDay: Record<WeekDay, Task[]>;
  assignableTasks: Task[];
  /** `${day}:${taskSlug}` keys marked to repeat next week. */
  recurringKeys: ReadonlySet<string>;
  onAssign: (task: Task, day: WeekDay) => void;
  onUnassign: (task: Task) => void;
  onToggleRecurring: (day: WeekDay, task: Task) => void;
}

const dateNum = (iso: string): string => String(Number(iso.slice(8, 10)));

export function PlanPhase({
  focusableQuests,
  focusSlugs,
  onToggleFocus,
  weekDates,
  assignmentsByDay,
  assignableTasks,
  recurringKeys,
  onAssign,
  onUnassign,
  onToggleRecurring,
}: PlanPhaseProps) {
  const focusCount = focusableQuests.filter((q) => focusSlugs.has(q.slug)).length;

  return (
    <div className="space-y-6">
      {/* Focus quests */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between px-1">
          <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Focus quests
          </h3>
          <span
            className={cn(
              "text-caption tabular-nums",
              focusCount > FOCUS_CAP ? "text-warning" : "text-muted-foreground",
            )}
          >
            {focusCount} / {FOCUS_CAP} picked
          </span>
        </div>
        <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-muted/20">
          {focusableQuests.length === 0 ? (
            <p className="px-4 py-3.5 text-body text-muted-foreground">
              No active quests to focus on. Start a quest first.
            </p>
          ) : (
            focusableQuests.map((quest) => {
              const slug = areaSlug(quest.area);
              const on = focusSlugs.has(quest.slug);
              return (
                <div key={quest.path} className="flex items-center gap-3 px-4 py-2.5">
                  <Checkbox
                    checked={on}
                    onCheckedChange={() => onToggleFocus(quest)}
                    aria-label={`Focus on ${quest.title || quest.slug}`}
                  />
                  <TypeIcon type="quest" />
                  <span className="min-w-0 flex-1 truncate text-body">
                    {quest.title || "Untitled quest"}
                  </span>
                  {slug && (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: areaColor(slug) ?? "#5F5F5F" }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Per-day assignment board */}
      <div className="space-y-2">
        <h3 className="px-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
          Assign the week
        </h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {PLAN_DAYS.map((day) => {
            const tasks = assignmentsByDay[day] ?? [];
            return (
              <div
                key={day}
                className="flex flex-col rounded-lg border border-border bg-card/60 p-2.5"
              >
                <div className="flex items-baseline justify-between px-0.5 pb-2">
                  <span className="text-body font-medium">{DAY_LABEL[day]}</span>
                  <span className="text-caption tabular-nums text-muted-foreground">
                    {dateNum(weekDates[day])}
                  </span>
                </div>
                <div className="flex-1 space-y-1.5">
                  {tasks.map((task) => {
                    const key = `${day}:${task.slug}`;
                    const recurring = recurringKeys.has(key);
                    return (
                      <div
                        key={task.path}
                        className="group flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-caption">
                          {task.title || "Untitled"}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="Repeat next week"
                              aria-pressed={recurring}
                              onClick={() => onToggleRecurring(day, task)}
                              className={cn(
                                "rounded-sm p-0.5 transition-colors",
                                recurring
                                  ? "text-info"
                                  : "text-muted-foreground/40 hover:text-foreground",
                              )}
                            >
                              <Repeat className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {recurring ? "Repeats next week" : "Repeat next week"}
                          </TooltipContent>
                        </Tooltip>
                        <button
                          type="button"
                          aria-label="Unassign"
                          onClick={() => onUnassign(task)}
                          className="rounded-sm p-0.5 text-muted-foreground/40 transition-colors hover:text-error"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <AssignPicker
                  tasks={assignableTasks}
                  onPick={(task) => onAssign(task, day)}
                  dayLabel={DAY_LABEL[day]}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AssignPicker({
  tasks,
  onPick,
  dayLabel,
}: {
  tasks: Task[];
  onPick: (task: Task) => void;
  dayLabel: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1.5 h-7 w-full justify-center gap-1 text-caption text-muted-foreground"
          disabled={!tasks.length}
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Add a task to ${dayLabel}…`} />
          <CommandList>
            <CommandEmpty>No tasks to assign.</CommandEmpty>
            {tasks.map((task) => {
              const slug = areaSlug(task.area);
              return (
                <CommandItem
                  key={task.path}
                  value={task.title ?? task.slug}
                  onSelect={() => onPick(task)}
                >
                  <TypeIcon type="task" className="size-3.5" />
                  <span className="truncate">{task.title || task.slug}</span>
                  {slug && (
                    <Badge variant="secondary" className="ml-auto font-normal">
                      {slug}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
