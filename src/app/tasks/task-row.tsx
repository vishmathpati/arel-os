/**
 * TaskRow — one row of the flat task table (Chapter 3 redesign v4).
 *
 * The title cell holds only the title; clicking the row EXPANDS it inline (the
 * TaskInlineEditor renders beneath) — no side panel, no ⋯ dropdown. The Status
 * column carries status + signals; the Context column is a quiet area dot + name
 * plus any Quest/Project link. Evening tasks get a moon in the When column.
 */

import {
  TaskInlineEditor,
  type TaskLinkOption,
  type TaskProjectOption,
} from "@/app/tasks/task-inline-editor";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { areaColor, areaLabel } from "@/shared/lib/areas";
import type { SchedulePick } from "@/shared/lib/tasks/schedule";
import { formatSchedule, isOverdue, scheduleBucket } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { TaskFrontmatter, TaskStatus } from "@/shared/lib/vault/schemas";
import { Bell, Compass, FolderKanban, Moon, Repeat2 } from "lucide-react";
import { Fragment } from "react";

/** Shared column grid — used by every row AND the table's column header. */
export const TASK_GRID =
  "grid grid-cols-[1.25rem_minmax(0,1fr)_7.5rem_minmax(0,13rem)_7rem] items-center gap-3 px-4";

interface TaskRowProps {
  task: Task;
  expanded: boolean;
  onToggleExpand: (task: Task) => void;
  onToggleDone: (task: Task) => void;
  onPatch: (task: Task, patch: Partial<TaskFrontmatter>, body?: string) => void;
  onSetStatus: (task: Task, status: TaskStatus) => void;
  onReschedule: (task: Task, pick: SchedulePick) => void;
  onDelete: (task: Task) => void;
  /** Forwarded to the inline editor's Project / Quest pickers (optional). */
  projectOptions?: TaskProjectOption[];
  questOptions?: TaskLinkOption[];
}

const STATUS_META: Record<TaskStatus, { dot: string; label: string; text: string }> = {
  open: { dot: "bg-muted-foreground/40", label: "Open", text: "text-muted-foreground" },
  waiting: { dot: "bg-warning", label: "Waiting", text: "text-warning" },
  done: { dot: "bg-success", label: "Done", text: "text-success" },
  dropped: { dot: "bg-muted-foreground/40", label: "Dropped", text: "text-muted-foreground/70" },
};

/** Prettify a wikilink stem into a label ("summer-trip" → "Summer trip"). */
function linkLabel(link: string): string {
  const stem = wikiTarget(link);
  return stem.charAt(0).toUpperCase() + stem.slice(1).replace(/-/g, " ");
}

function StatusCell({ task }: { task: Task }) {
  const meta = STATUS_META[task.status];
  const steps = task.steps ?? [];
  const doneSteps = steps.filter((s) => s.done).length;
  return (
    <div className="flex min-w-0 items-center gap-2 text-caption">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
        <span className={cn("truncate", meta.text)}>{meta.label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground/70">
        {task.repeat && task.repeat !== "none" && <Repeat2 className="size-3.5" />}
        {task.notify && <Bell className="size-3.5" />}
        {steps.length > 0 && (
          <span className="tabular-nums">
            {doneSteps}/{steps.length}
          </span>
        )}
      </span>
    </div>
  );
}

function ContextCell({ task }: { task: Task }) {
  const area = areaLabel(task.area);
  const color = areaColor(task.area);
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-caption text-muted-foreground">
      {area ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color ?? "#5F5F5F" }}
          />
          <span className="truncate">{area}</span>
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      )}
      {task.quest && (
        <span className="flex min-w-0 items-center gap-1" title="Quest">
          <Compass className="size-3 shrink-0" />
          <span className="truncate">{linkLabel(task.quest)}</span>
        </span>
      )}
      {task.project && (
        <span className="flex min-w-0 items-center gap-1" title="Project">
          <FolderKanban className="size-3 shrink-0" />
          <span className="truncate">{linkLabel(task.project)}</span>
        </span>
      )}
    </div>
  );
}

function WhenCell({ task }: { task: Task }) {
  const overdue = isOverdue(task.schedule, task.status);
  if (scheduleBucket(task.schedule) === "this-evening") {
    return (
      <span className="flex items-center gap-1 text-caption text-muted-foreground">
        <Moon className="size-3.5" />
        Evening
      </span>
    );
  }
  return (
    <span className={cn("text-caption text-muted-foreground", overdue && "text-error")}>
      {formatSchedule(task.schedule)}
    </span>
  );
}

export function TaskRow({
  task,
  expanded,
  onToggleExpand,
  onToggleDone,
  onPatch,
  onSetStatus,
  onReschedule,
  onDelete,
  projectOptions,
  questOptions,
}: TaskRowProps) {
  const done = task.status === "done";
  const struck = done || task.status === "dropped";

  return (
    <Fragment>
      <button
        type="button"
        onClick={() => onToggleExpand(task)}
        className={cn(
          TASK_GRID,
          "h-11 w-full cursor-pointer border-b border-border/60 text-left transition-colors hover:bg-hover",
          expanded && "bg-hover",
        )}
      >
        {/* checkbox — own click, doesn't toggle the row */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: span only stops propagation for the nested control. */}
        <span onClick={(e) => e.stopPropagation()} className="flex items-center justify-center">
          <Checkbox
            checked={done}
            onCheckedChange={() => onToggleDone(task)}
            aria-label={done ? "Mark not done" : "Mark done"}
          />
        </span>

        <span
          className={cn(
            "min-w-0 truncate text-body transition-colors duration-fast",
            struck && "text-muted-foreground line-through",
          )}
        >
          {task.title || "Untitled"}
        </span>

        <StatusCell task={task} />
        <ContextCell task={task} />
        <WhenCell task={task} />
      </button>

      {expanded && (
        <TaskInlineEditor
          task={task}
          onPatch={onPatch}
          onSetStatus={onSetStatus}
          onReschedule={onReschedule}
          onDelete={onDelete}
          projectOptions={projectOptions}
          questOptions={questOptions}
        />
      )}
    </Fragment>
  );
}
