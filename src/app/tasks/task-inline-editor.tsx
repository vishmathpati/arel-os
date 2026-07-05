/**
 * TaskInlineEditor — the panel that expands beneath a row (replacing the old
 * side Sheet). Every option is a direct control — status/when/repeat as pills,
 * area as colored dots — so nothing hides behind a dropdown. Title and notes keep
 * local state; the editor remounts per expanded row, so it re-seeds naturally.
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { SchedulePicker } from "@/app/tasks/schedule-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { areaSlug, areaWikilink } from "@/shared/lib/areas";
import { type SchedulePick, scheduleBucket } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import type {
  TaskFrontmatter,
  TaskRepeatRule,
  TaskStatus,
  TaskStep,
} from "@/shared/lib/vault/schemas";
import { CalendarClock, Plus, Trash2, X } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

/** Minimal entity shape for the Project / Quest pickers (avoids importing data layers). */
export interface TaskLinkOption {
  slug: string;
  title: string;
  /** Bare area slug — used to offer only same-area entities. */
  area: string;
}
export type TaskProjectOption = TaskLinkOption;

interface TaskInlineEditorProps {
  task: Task;
  onPatch: (task: Task, patch: Partial<TaskFrontmatter>, body?: string) => void;
  onSetStatus: (task: Task, status: TaskStatus) => void;
  onReschedule: (task: Task, pick: SchedulePick) => void;
  onDelete: (task: Task) => void;
  /** When provided, a Project picker shows (projects in the task's area). */
  projectOptions?: TaskProjectOption[];
  /** When provided, a Quest picker shows (quests in the task's area). */
  questOptions?: TaskLinkOption[];
}

const PILL_BASE = "rounded-md px-2.5 py-1 text-caption transition-colors border border-transparent";
const PILL_OFF = "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 pt-1.5 text-caption text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

const STATUS_PILLS: ReadonlyArray<{ value: TaskStatus; label: string; on: string }> = [
  { value: "open", label: "Open", on: "bg-accent text-accent-foreground border-transparent" },
  { value: "waiting", label: "Waiting", on: "bg-warning/15 text-warning border-transparent" },
  { value: "done", label: "Done", on: "bg-success/15 text-success border-transparent" },
  { value: "dropped", label: "Dropped", on: "bg-muted text-muted-foreground border-transparent" },
];

const WHEN_PILLS: ReadonlyArray<{ pick: SchedulePick; label: string; bucket: string }> = [
  { pick: "today", label: "Today", bucket: "today" },
  { pick: "this-evening", label: "This evening", bucket: "this-evening" },
  { pick: "tomorrow", label: "Tomorrow", bucket: "tomorrow" },
  { pick: "this-week", label: "This week", bucket: "this-week" },
  { pick: "someday", label: "Someday", bucket: "someday" },
  { pick: "unscheduled", label: "Unscheduled", bucket: "unscheduled" },
];

const REPEAT_PILLS: ReadonlyArray<{ value: TaskRepeatRule; label: string }> = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "every-n-days", label: "Every N days" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function TaskInlineEditor({
  task,
  onPatch,
  onSetStatus,
  onReschedule,
  onDelete,
  projectOptions,
  questOptions,
}: TaskInlineEditorProps) {
  const { topLevelAreas } = useAreasContext();
  const [title, setTitle] = useState(task.title ?? "");
  const [body, setBody] = useState(task.body);
  const [newStep, setNewStep] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentBucket = scheduleBucket(task.schedule);
  const currentArea = areaSlug(task.area);
  const currentProject = task.project ? wikiTarget(task.project) : null;
  const currentQuest = task.quest ? wikiTarget(task.quest) : null;
  // Only offer projects/quests that live in the task's current area (one-home rule).
  const areaProjects = (projectOptions ?? []).filter((p) => p.area === currentArea);
  const areaQuests = (questOptions ?? []).filter((qq) => qq.area === currentArea);

  const commitTitle = () => {
    const next = title.trim();
    if (next !== (task.title ?? "")) onPatch(task, { title: next });
  };

  const commitBody = (value: string) => {
    setBody(value);
    if (bodyTimer.current) clearTimeout(bodyTimer.current);
    bodyTimer.current = setTimeout(() => {
      if (value !== task.body) onPatch(task, {}, value);
    }, 700);
  };
  const flushBody = () => {
    if (bodyTimer.current) clearTimeout(bodyTimer.current);
    if (body !== task.body) onPatch(task, {}, body);
  };

  const setSteps = (steps: TaskStep[]) => onPatch(task, { steps });
  const addStep = () => {
    const t = newStep.trim();
    if (!t) return;
    setSteps([...(task.steps ?? []), { title: t, done: false }]);
    setNewStep("");
  };
  const onStepKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addStep();
    }
  };

  return (
    <div className="flex flex-col gap-3.5 bg-card/40 px-4 pt-1 pb-4 pl-[3.25rem]">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="Task title"
        className="h-auto border-0 bg-transparent px-0 py-0 text-body font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
      />

      <Field label="Status">
        {STATUS_PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onSetStatus(task, p.value)}
            className={cn(PILL_BASE, task.status === p.value ? p.on : PILL_OFF)}
          >
            {p.label}
          </button>
        ))}
      </Field>

      <Field label="When">
        {WHEN_PILLS.map((p) => (
          <button
            key={p.bucket}
            type="button"
            onClick={() => onReschedule(task, p.pick)}
            className={cn(
              PILL_BASE,
              currentBucket === p.bucket
                ? "border-transparent bg-accent text-accent-foreground"
                : PILL_OFF,
            )}
          >
            {p.label}
          </button>
        ))}
        <SchedulePicker value={task.schedule} onPick={(pick) => onReschedule(task, pick)}>
          <button
            type="button"
            className={cn(PILL_BASE, PILL_OFF, "flex items-center gap-1")}
            aria-label="Pick a date"
          >
            <CalendarClock className="size-3.5" />
          </button>
        </SchedulePicker>
      </Field>

      <Field label="Area">
        {topLevelAreas.map((a) => (
          <button
            key={a.slug}
            type="button"
            onClick={() => onPatch(task, { area: areaWikilink(a.slug) })}
            className={cn(
              PILL_BASE,
              "flex items-center gap-1.5",
              currentArea === a.slug
                ? "border-transparent bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent",
            )}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
            {a.name}
          </button>
        ))}
        {currentArea && (
          <button
            type="button"
            onClick={() => onPatch(task, { area: undefined })}
            className={cn(PILL_BASE, PILL_OFF)}
          >
            Clear
          </button>
        )}
      </Field>

      {projectOptions && currentArea && (
        <Field label="Project">
          {areaProjects.length === 0 ? (
            <span className="pt-1 text-caption text-muted-foreground/60">
              No projects in this area yet.
            </span>
          ) : (
            areaProjects.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => onPatch(task, { project: toWikilink(p.slug) })}
                className={cn(
                  PILL_BASE,
                  currentProject === p.slug
                    ? "border-transparent bg-muted text-foreground"
                    : PILL_OFF,
                )}
              >
                {p.title || p.slug}
              </button>
            ))
          )}
          {currentProject && (
            <button
              type="button"
              onClick={() => onPatch(task, { project: undefined })}
              className={cn(PILL_BASE, PILL_OFF)}
            >
              Clear
            </button>
          )}
        </Field>
      )}

      {questOptions && currentArea && (
        <Field label="Quest">
          {areaQuests.length === 0 ? (
            <span className="pt-1 text-caption text-muted-foreground/60">
              No quests in this area yet.
            </span>
          ) : (
            areaQuests.map((qq) => (
              <button
                key={qq.slug}
                type="button"
                onClick={() => onPatch(task, { quest: toWikilink(qq.slug) })}
                className={cn(
                  PILL_BASE,
                  currentQuest === qq.slug
                    ? "border-transparent bg-muted text-foreground"
                    : PILL_OFF,
                )}
              >
                {qq.title || qq.slug}
              </button>
            ))
          )}
          {currentQuest && (
            <button
              type="button"
              onClick={() => onPatch(task, { quest: undefined })}
              className={cn(PILL_BASE, PILL_OFF)}
            >
              Clear
            </button>
          )}
        </Field>
      )}

      <Field label="Repeat">
        {REPEAT_PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPatch(task, { repeat: p.value })}
            className={cn(
              PILL_BASE,
              task.repeat === p.value
                ? "border-transparent bg-accent text-accent-foreground"
                : PILL_OFF,
            )}
          >
            {p.label}
          </button>
        ))}
        {task.repeat === "every-n-days" && (
          <Input
            type="number"
            min={1}
            value={task.repeat_interval ?? 1}
            onChange={(e) =>
              onPatch(task, { repeat_interval: Math.max(1, Number(e.target.value) || 1) })
            }
            className="h-7 w-16"
            aria-label="Interval in days"
          />
        )}
      </Field>

      <Field label="Remind">
        <div className="flex items-center gap-2">
          <Switch
            checked={task.notify}
            onCheckedChange={(checked) => onPatch(task, { notify: checked })}
          />
          <span className="text-caption text-muted-foreground">{task.notify ? "On" : "Off"}</span>
        </div>
        {task.notify && (
          <>
            <Input
              type="number"
              min={0}
              value={task.notify_lead ?? ""}
              onChange={(e) =>
                onPatch(task, {
                  notify_lead: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="0"
              className="h-7 w-16"
              aria-label="Minutes before"
            />
            <span className="text-caption text-muted-foreground">min before</span>
            <button
              type="button"
              onClick={() => onPatch(task, { reminder_only: !task.reminder_only })}
              className={cn(
                PILL_BASE,
                task.reminder_only
                  ? "border-transparent bg-accent text-accent-foreground"
                  : PILL_OFF,
              )}
            >
              Nudge only
            </button>
          </>
        )}
      </Field>

      <Field label="Steps">
        <div className="flex w-full flex-col gap-1">
          {(task.steps ?? []).map((step, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: order is the step identity.
              key={i}
              className="group/step flex items-center gap-2"
            >
              <Checkbox
                checked={step.done}
                onCheckedChange={(checked) =>
                  setSteps(
                    (task.steps ?? []).map((s, j) =>
                      j === i ? { ...s, done: checked === true } : s,
                    ),
                  )
                }
              />
              <span
                className={cn(
                  "flex-1 text-caption",
                  step.done && "text-muted-foreground line-through",
                )}
              >
                {step.title}
              </span>
              <button
                type="button"
                onClick={() => setSteps((task.steps ?? []).filter((_, j) => j !== i))}
                className="text-muted-foreground/60 opacity-0 hover:text-foreground group-hover/step:opacity-100"
                aria-label="Remove step"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Plus className="size-3.5 text-muted-foreground" />
            <Input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              onKeyDown={onStepKey}
              onBlur={addStep}
              placeholder="Add a sub-step"
              className="h-7 border-0 bg-transparent px-0 text-caption shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
        </div>
      </Field>

      <Field label="Notes">
        <Textarea
          value={body}
          onChange={(e) => commitBody(e.target.value)}
          onBlur={flushBody}
          placeholder="Add notes…"
          className="min-h-16 w-full text-caption"
        />
      </Field>

      <div className="pl-[4.75rem]">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-1.5 text-caption text-error hover:underline"
        >
          <Trash2 className="size-3.5" />
          Delete task
        </button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              “{task.title || "Untitled"}” will be moved to the archive. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              autoFocus
              onClick={() => {
                setConfirmOpen(false);
                onDelete(task);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
