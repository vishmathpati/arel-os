/**
 * Plan tomorrow (Ch11 / D35) — three quick-action steps: clear today's
 * leftovers (one-tap reschedule / drop / complete), line up tomorrow's focus
 * (a picker spanning tasks · projects · quests), and name the first move.
 * Pure presentation — all mutations are passed in from the page.
 */

import { Section } from "@/app/rituals/check-in-kit";
import { TypeIcon } from "@/shared/components/type-icon";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import type { SchedulePick } from "@/shared/lib/tasks/schedule";
import { formatSchedule } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import { ArrowRight, Plus, Sunrise, X } from "lucide-react";
import { useState } from "react";

export type FocusType = "task" | "project" | "quest";

export interface FocusOption {
  /** Unique key across types — `${type}:${slug}`. */
  key: string;
  type: FocusType;
  slug: string;
  label: string;
  area?: string;
}

interface PlanTomorrowProps {
  leftovers: Task[];
  onReschedule: (task: Task, pick: SchedulePick) => void;
  onDrop: (task: Task) => void;
  onComplete: (task: Task) => void;
  candidates: FocusOption[];
  /** Selected focus slugs (parsed from evening.tomorrow_focus). */
  focus: ReadonlySet<string>;
  onToggleFocus: (opt: FocusOption) => void;
  firstMove: string;
  onFirstMoveChange: (v: string) => void;
}

export function PlanTomorrow({
  leftovers,
  onReschedule,
  onDrop,
  onComplete,
  candidates,
  focus,
  onToggleFocus,
  firstMove,
  onFirstMoveChange,
}: PlanTomorrowProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-subheading">
          <Sunrise className="size-4 text-muted-foreground" />
          Plan tomorrow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 1 — leftovers */}
        <Section title={`Clear today${leftovers.length ? ` · ${leftovers.length} left` : ""}`}>
          {leftovers.length === 0 ? (
            <p className="px-4 py-3 text-body text-success">Nothing left on today — clean slate.</p>
          ) : (
            leftovers.map((task) => (
              <div key={task.path} className="flex items-center gap-3 px-4 py-2.5">
                <Checkbox
                  checked={false}
                  onCheckedChange={() => onComplete(task)}
                  aria-label="Mark done"
                />
                <span className="min-w-0 flex-1 truncate text-body">
                  {task.title || "Untitled"}
                </span>
                <span className="shrink-0 text-caption text-error">
                  {formatSchedule(task.schedule)}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <QuickBtn onClick={() => onReschedule(task, "tomorrow")}>Tomorrow</QuickBtn>
                  <QuickBtn onClick={() => onReschedule(task, "this-week")}>Week</QuickBtn>
                  <QuickBtn onClick={() => onReschedule(task, "someday")}>Someday</QuickBtn>
                  <QuickBtn onClick={() => onDrop(task)} danger>
                    Drop
                  </QuickBtn>
                </div>
              </div>
            ))
          )}
        </Section>

        {/* 2 — tomorrow's focus */}
        <div className="space-y-2">
          <h3 className="px-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
            Tomorrow's focus
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {candidates
              .filter((c) => focus.has(c.slug))
              .map((c) => {
                return (
                  <Badge
                    key={c.key}
                    variant="secondary"
                    className="gap-1 py-1 pl-2.5 pr-1 text-body font-normal"
                  >
                    <TypeIcon type={c.type} className="size-3" />
                    <span className="max-w-48 truncate">{c.label}</span>
                    <button
                      type="button"
                      onClick={() => onToggleFocus(c)}
                      aria-label="Remove"
                      className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            <FocusPicker candidates={candidates} onToggle={onToggleFocus} />
          </div>
        </div>

        {/* 3 — first move */}
        <div className="space-y-2">
          <h3 className="px-1 text-caption font-medium uppercase tracking-wide text-muted-foreground">
            First move tomorrow
          </h3>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3">
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={firstMove}
              onChange={(e) => onFirstMoveChange(e.target.value)}
              placeholder="The one thing to start with…"
              className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickBtn({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn("h-7 px-2 text-caption text-muted-foreground", danger && "hover:text-error")}
    >
      {children}
    </Button>
  );
}

function FocusPicker({
  candidates,
  onToggle,
}: {
  candidates: FocusOption[];
  onToggle: (opt: FocusOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const groups: FocusType[] = ["task", "project", "quest"];
  const headings = { task: "Tasks", project: "Projects", quest: "Quests" } as const;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1" disabled={!candidates.length}>
          <Plus className="size-3.5" />
          Add focus
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Pick a task, project, or quest…" />
          <CommandList>
            <CommandEmpty>Nothing to pick.</CommandEmpty>
            {groups.map((g) => {
              const opts = candidates.filter((c) => c.type === g);
              if (!opts.length) return null;
              return (
                <CommandGroup key={g} heading={headings[g]}>
                  {opts.map((c) => (
                    <CommandItem
                      key={c.key}
                      value={`${c.type} ${c.label}`}
                      onSelect={() => onToggle(c)}
                    >
                      <TypeIcon type={c.type} className="size-3.5" />
                      <span className="truncate">{c.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
