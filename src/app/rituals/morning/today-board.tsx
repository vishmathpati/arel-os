/**
 * TodayBoard (Ch10 / D34) — the union of everything carrying a today-state,
 * laid out for action. Task sections reuse the flagship TaskRow table verbatim
 * (one canonical task list — DESIGN.md), grouped Overdue → Today → This Evening.
 * A side rail holds this week's focus quests and today's reminders. "Today's
 * wins" (Q8) is a Popover picker over the actionable tasks — the flagship row is
 * left untouched; wins write to the daily note's `must_do`.
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import type { TaskLinkOption, TaskProjectOption } from "@/app/tasks/task-inline-editor";
import { TASK_GRID, TaskRow } from "@/app/tasks/task-row";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import type { Quest } from "@/shared/lib/quest-data";
import { QUEST_STATUS_META } from "@/shared/lib/quests";
import { formatSchedule } from "@/shared/lib/tasks/schedule";
import type { SchedulePick } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import type { TodayBundle } from "@/shared/lib/today";
import { cn } from "@/shared/lib/utils";
import type { TaskFrontmatter, TaskStatus } from "@/shared/lib/vault/schemas";
import { Bell, Check, Compass, Plus, Star, X } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";

/** Handlers + options the flagship TaskRow needs, forwarded from the page. */
export interface RowProps {
  onToggleExpand: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onPatch: (task: Task, patch: Partial<TaskFrontmatter>, body?: string) => void;
  onSetStatus: (task: Task, status: TaskStatus) => void;
  onReschedule: (task: Task, pick: SchedulePick) => void;
  onDelete: (task: Task) => void;
  projectOptions?: TaskProjectOption[];
  questOptions?: TaskLinkOption[];
}

interface TodayBoardProps {
  bundle: TodayBundle;
  rowProps: RowProps;
  expandedPath: string | null;
  /** Selected win task-slugs (parsed from the daily note's must_do). */
  wins?: ReadonlySet<string>;
  /** When omitted (manifesto not started yet) the wins card is hidden. */
  onToggleWin?: (slug: string) => void;
}

const MAX_WINS = 3;

export function TodayBoard({ bundle, rowProps, expandedPath, wins, onToggleWin }: TodayBoardProps) {
  const sections = [
    { key: "overdue", label: "Overdue", labelClass: "text-error", tasks: bundle.overdue },
    { key: "today", label: "Today", tasks: bundle.today },
    { key: "evening", label: "This Evening", tasks: bundle.evening },
  ].filter((s) => s.tasks.length > 0);

  const candidates = [...bundle.overdue, ...bundle.today, ...bundle.evening];
  const hasWork = candidates.length > 0;

  return (
    <div className="space-y-4">
      {onToggleWin && (
        <WinsCard
          candidates={candidates}
          completed={bundle.completedToday}
          wins={wins ?? new Set()}
          onToggleWin={onToggleWin}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Main — the actionable task table */}
        {hasWork ? (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div
              className={cn(
                TASK_GRID,
                "h-8 border-b border-border text-caption text-muted-foreground",
              )}
            >
              <span />
              <span>Task</span>
              <span>Status</span>
              <span>Context</span>
              <span>When</span>
            </div>
            {sections.map((section) => (
              <Fragment key={section.key}>
                <div className="flex h-9 items-center gap-2 border-b border-border/60 bg-muted/20 px-4">
                  <span className={cn("text-sm font-medium", section.labelClass)}>
                    {section.label}
                  </span>
                  <span className="text-caption text-muted-foreground">{section.tasks.length}</span>
                </div>
                {section.tasks.map((task) => (
                  <TaskRow
                    key={task.path}
                    task={task}
                    expanded={expandedPath === task.path}
                    {...rowProps}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-16 text-center">
            <Star className="size-5 text-muted-foreground" />
            <h3 className="mt-3 text-subheading font-medium">Nothing on the board today</h3>
            <p className="mt-1 max-w-sm text-body text-muted-foreground">
              Tasks scheduled for today, overdue, or due this evening will gather here.
            </p>
          </div>
        )}

        {/* Side rail */}
        <aside className="space-y-4">
          <FocusQuestsCard quests={bundle.focusQuests} />
          <RemindersCard reminders={bundle.reminders} />
        </aside>
      </div>
    </div>
  );
}

function WinsCard({
  candidates,
  completed,
  wins,
  onToggleWin,
}: {
  candidates: Task[];
  completed: Task[];
  wins: ReadonlySet<string>;
  onToggleWin: (slug: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Resolve picked chips from actionable + already-completed tasks, so a starred
  // win that gets done still shows (as achieved) rather than vanishing.
  const picked = [...candidates, ...completed].filter((t) => wins.has(t.slug));
  const atMax = picked.length >= MAX_WINS;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-subheading">
          <Star className="size-4 text-muted-foreground" />
          What would make today a win?
          <span className="ml-auto text-caption font-normal text-muted-foreground tabular-nums">
            {picked.length}/{MAX_WINS}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          {picked.map((t) => {
            const done = t.status === "done";
            return (
              <Badge
                key={t.slug}
                variant="secondary"
                className="gap-1 py-1 pl-2.5 pr-1 text-body font-normal"
              >
                {done ? (
                  <Check className="size-3 shrink-0 text-success" />
                ) : (
                  <Star className="size-3 shrink-0" />
                )}
                <span className={cn("max-w-48 truncate", done && "line-through opacity-70")}>
                  {t.title || "Untitled"}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleWin(t.slug)}
                  aria-label="Remove win"
                  className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}

          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!candidates.length || atMax}
                className="h-7 gap-1"
              >
                <Plus className="size-3.5" />
                Add a win
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <Command>
                <CommandInput placeholder="Pick from today's tasks…" />
                <CommandList>
                  <CommandEmpty>No tasks to pick.</CommandEmpty>
                  <CommandGroup>
                    {candidates.map((t) => (
                      <CommandItem
                        key={t.slug}
                        value={`${t.title} ${t.slug}`}
                        onSelect={() => {
                          onToggleWin(t.slug);
                          setOpen(false);
                        }}
                      >
                        <Star
                          className={cn(
                            "size-3.5",
                            wins.has(t.slug) ? "text-foreground" : "text-muted-foreground/40",
                          )}
                        />
                        <span className="truncate">{t.title || "Untitled"}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {!picked.length && (
            <span className="text-caption text-muted-foreground">
              Star 1–3 tasks to anchor your day.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FocusQuestsCard({ quests }: { quests: Quest[] }) {
  const { colorOf } = useAreasContext();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-subheading">
          <Compass className="size-4 text-muted-foreground" />
          This week's focus
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {quests.length === 0 ? (
          <p className="text-caption text-muted-foreground">
            No focus quests set. Mark a quest as focus to surface it here.
          </p>
        ) : (
          quests.map((q) => {
            const meta = QUEST_STATUS_META[q.status];
            const color = colorOf(q.area);
            return (
              <Link
                key={q.slug}
                to={`/quests/${q.slug}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-hover"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color ?? "#5F5F5F" }}
                />
                <span className="min-w-0 flex-1 truncate text-body">{q.title || q.slug}</span>
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", meta.dotClass)}
                  title={meta.label}
                />
              </Link>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function RemindersCard({ reminders }: { reminders: Task[] }) {
  if (reminders.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-subheading">
          <Bell className="size-4 text-muted-foreground" />
          Reminders today
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {reminders.map((t) => {
          return (
            <div key={t.path} className="flex items-center gap-2 px-2 py-1">
              <Bell className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-body">{t.title || "Untitled"}</span>
              <span className="shrink-0 text-caption text-muted-foreground">
                {formatSchedule(t.schedule)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
