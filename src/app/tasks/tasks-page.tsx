/**
 * TasksPage — the flagship task table (Chapter 3 redesign v4).
 *
 * A lens filters the set (Today / This Week / Someday / All / Recurring /
 * Reminders); the result renders as ONE flat list by default — no schedule
 * sub-sections. Grouping is opt-in (Group by Status / Area). Clicking a row
 * expands it inline (TaskInlineEditor) — there is no side panel.
 */

import { PageHeader } from "@/app/page-header";
import { useProjects } from "@/app/projects/use-projects";
import { useQuests } from "@/app/quests/use-quests";
import { TASK_GRID, TaskRow } from "@/app/tasks/task-row";
import { type TaskCounts, TaskStatBand } from "@/app/tasks/task-stat-band";
import { useTasks } from "@/app/tasks/use-tasks";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AREA_OPTIONS, areaSlug } from "@/shared/lib/areas";
import {
  type ScheduleBucket,
  resolvePick,
  scheduleBucket,
  scheduleSortKey,
} from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { TaskSchedule, TaskStatus } from "@/shared/lib/vault/schemas";
import { Compass, FolderKanban, ListPlus, type LucideIcon, Plus } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Lens = "today" | "this-week" | "someday" | "all" | "recurring" | "reminders";
type GroupBy = "none" | "status" | "area" | "project" | "quest";

const LENSES: ReadonlyArray<{ key: Lens; label: string }> = [
  { key: "today", label: "Today" },
  { key: "this-week", label: "This Week" },
  { key: "someday", label: "Someday" },
  { key: "all", label: "All" },
  { key: "recurring", label: "Recurring" },
  { key: "reminders", label: "Reminders" },
];

const LENS_BUCKETS: Partial<Record<Lens, readonly ScheduleBucket[]>> = {
  today: ["overdue", "today", "this-evening"],
  // The whole week in one flat list (Today's tasks included — no sub-sections).
  "this-week": ["overdue", "today", "this-evening", "tomorrow", "this-week"],
  someday: ["someday", "unscheduled"],
};

const STATUS_META: Record<TaskStatus, { label: string; dotClass: string; labelClass?: string }> = {
  open: { label: "Open", dotClass: "bg-muted-foreground/50" },
  waiting: { label: "Waiting", dotClass: "bg-warning", labelClass: "text-warning" },
  done: { label: "Done", dotClass: "bg-success", labelClass: "text-success" },
  dropped: { label: "Dropped", dotClass: "bg-muted-foreground/40" },
};
const STATUS_ORDER: readonly TaskStatus[] = ["open", "waiting", "done", "dropped"];

interface Section {
  key: string;
  label: string;
  dotClass?: string;
  dotColor?: string;
  icon?: LucideIcon;
  labelClass?: string;
  tasks: Task[];
}

/** Prettify a wikilink stem into a label ("meal-system" → "Meal system"). */
function prettyStem(stem: string): string {
  return stem.charAt(0).toUpperCase() + stem.slice(1).replace(/-/g, " ");
}

function isFinished(t: Task): boolean {
  return t.status === "done" || t.status === "dropped";
}

function sortTasks(tasks: Task[], now: Date): Task[] {
  return [...tasks].sort((a, b) => {
    const fa = isFinished(a) ? 1 : 0;
    const fb = isFinished(b) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    const [ao, ad] = scheduleSortKey(a.schedule, now);
    const [bo, bd] = scheduleSortKey(b.schedule, now);
    if (ao !== bo) return ao - bo;
    if (ad !== bd) return ad - bd;
    // Newest first within the same slot → a freshly-added task comes first.
    return (b.created ?? "").localeCompare(a.created ?? "");
  });
}

function filterByLens(tasks: Task[], lens: Lens, now: Date): Task[] {
  if (lens === "all") return tasks;
  if (lens === "recurring") {
    return tasks.filter((t) => t.repeat && t.repeat !== "none" && !isFinished(t));
  }
  if (lens === "reminders") {
    return tasks.filter((t) => t.notify && !isFinished(t));
  }
  const allowed = LENS_BUCKETS[lens] ?? [];
  return tasks.filter((t) => !isFinished(t) && allowed.includes(scheduleBucket(t.schedule, now)));
}

function statusSections(tasks: Task[], now: Date): Section[] {
  const byStatus = new Map<TaskStatus, Task[]>();
  for (const task of tasks) {
    (byStatus.get(task.status) ?? byStatus.set(task.status, []).get(task.status))?.push(task);
  }
  return STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => ({
    key: s,
    label: STATUS_META[s].label,
    dotClass: STATUS_META[s].dotClass,
    labelClass: STATUS_META[s].labelClass,
    tasks: sortTasks(byStatus.get(s) ?? [], now),
  }));
}

function areaSections(tasks: Task[], now: Date): Section[] {
  const byArea = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = areaSlug(task.area) ?? "unhomed";
    (byArea.get(key) ?? byArea.set(key, []).get(key))?.push(task);
  }
  const sections: Section[] = [];
  for (const a of AREA_OPTIONS) {
    if (byArea.has(a.slug)) {
      sections.push({
        key: a.slug,
        label: a.label,
        dotColor: a.color,
        tasks: sortTasks(byArea.get(a.slug) ?? [], now),
      });
    }
  }
  if (byArea.has("unhomed")) {
    sections.push({
      key: "unhomed",
      label: "Unhomed",
      dotClass: "bg-muted-foreground/40",
      tasks: sortTasks(byArea.get("unhomed") ?? [], now),
    });
  }
  return sections;
}

/** Group tasks by a wikilink field (project / quest); unlinked tasks go last. */
function linkSections(
  tasks: Task[],
  now: Date,
  field: "project" | "quest",
  icon: LucideIcon,
  noneLabel: string,
): Section[] {
  const byKey = new Map<string, Task[]>();
  for (const task of tasks) {
    const link = task[field];
    const key = link ? wikiTarget(link) : "__none__";
    (byKey.get(key) ?? byKey.set(key, []).get(key))?.push(task);
  }
  const sections: Section[] = [...byKey.keys()]
    .filter((k) => k !== "__none__")
    .sort()
    .map((key) => ({
      key,
      label: prettyStem(key),
      icon,
      tasks: sortTasks(byKey.get(key) ?? [], now),
    }));
  if (byKey.has("__none__")) {
    sections.push({
      key: "__none__",
      label: noneLabel,
      dotClass: "bg-muted-foreground/40",
      tasks: sortTasks(byKey.get("__none__") ?? [], now),
    });
  }
  return sections;
}

function countTasks(tasks: Task[], now: Date): TaskCounts {
  let overdue = 0;
  let today = 0;
  let week = 0;
  let done = 0;
  for (const t of tasks) {
    if (t.status === "done") {
      done += 1;
      continue;
    }
    if (t.status === "dropped") continue;
    const b = scheduleBucket(t.schedule, now);
    if (b === "overdue") overdue += 1;
    if (b === "today" || b === "this-evening") today += 1;
    if (b === "today" || b === "this-evening" || b === "tomorrow" || b === "this-week") week += 1;
  }
  return { overdue, today, week, done };
}

export function TasksPage() {
  const {
    tasks,
    loading,
    error,
    reload,
    create,
    patch,
    toggleDone,
    setStatus,
    reschedule,
    remove,
  } = useTasks();
  const { projects } = useProjects();
  const { quests } = useQuests();
  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        slug: p.slug,
        title: p.title ?? p.slug,
        area: areaSlug(p.area) ?? "",
      })),
    [projects],
  );
  const questOptions = useMemo(
    () =>
      quests.map((qq) => ({
        slug: qq.slug,
        title: qq.title ?? qq.slug,
        area: areaSlug(qq.area) ?? "",
      })),
    [quests],
  );
  const [lens, setLens] = useState<Lens>("today");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const quickAdd = useRef<HTMLInputElement>(null);

  const now = useMemo(() => new Date(), []);
  const counts = useMemo(() => countTasks(tasks, now), [tasks, now]);

  const filtered = useMemo(() => filterByLens(tasks, lens, now), [tasks, lens, now]);
  const flatTasks = useMemo(
    () => (groupBy === "none" ? sortTasks(filtered, now) : null),
    [filtered, groupBy, now],
  );
  const sections = useMemo(() => {
    switch (groupBy) {
      case "status":
        return statusSections(filtered, now);
      case "area":
        return areaSections(filtered, now);
      case "project":
        return linkSections(filtered, now, "project", FolderKanban, "No project");
      case "quest":
        return linkSections(filtered, now, "quest", Compass, "No quest");
      default:
        return [];
    }
  }, [filtered, groupBy, now]);

  const isEmpty = groupBy === "none" ? (flatTasks?.length ?? 0) === 0 : sections.length === 0;

  // Cursor ready in the add field whenever the page opens. ⌘N is owned by the
  // global quick-capture (Ch9) — the task quick-add stays auto-focused + clickable.
  useEffect(() => {
    quickAdd.current?.focus();
  }, []);

  const toggleExpand = useCallback((task: Task) => {
    setExpandedPath((prev) => (prev === task.path ? null : task.path));
  }, []);

  const lensSchedule = (l: Lens): TaskSchedule => {
    switch (l) {
      case "someday":
        return "someday";
      case "all":
        return "unscheduled";
      case "this-week":
        return resolvePick("this-week");
      default:
        return resolvePick("today");
    }
  };

  const submitDraft = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    await create({ title, schedule: lensSchedule(lens) });
    quickAdd.current?.focus();
  };

  const rowProps = {
    onToggleExpand: toggleExpand,
    onToggleDone: toggleDone,
    onPatch: patch,
    onSetStatus: setStatus,
    onReschedule: reschedule,
    onDelete: remove,
    projectOptions,
    questOptions,
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Tasks" }]} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          <TaskStatBand
            counts={counts}
            onSelect={(key) =>
              setLens(key === "week" ? "this-week" : key === "done" ? "all" : "today")
            }
          />

          {/* Toolbar */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {LENSES.map(({ key, label }) => (
                <Button
                  key={key}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "text-muted-foreground",
                    lens === key && "bg-accent text-accent-foreground",
                  )}
                  onClick={() => setLens(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-caption text-muted-foreground">Group by</span>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                <SelectTrigger size="sm" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="area">Area</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="quest">Quest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick-add */}
          <div className="mt-3 flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4">
            <Plus className="size-4 shrink-0 text-muted-foreground" />
            <Input
              ref={quickAdd}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitDraft()}
              placeholder="Add a task…"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>

          {/* The table */}
          <div className="mt-4">
            {loading ? (
              <LoadingTable />
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn't load tasks</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
                  Retry
                </Button>
              </Alert>
            ) : isEmpty ? (
              <EmptyState lens={lens} />
            ) : (
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

                {groupBy === "none"
                  ? flatTasks?.map((task) => (
                      <TaskRow
                        key={task.path}
                        task={task}
                        expanded={expandedPath === task.path}
                        {...rowProps}
                      />
                    ))
                  : sections.map((section) => (
                      <Fragment key={section.key}>
                        <div className="flex h-9 items-center gap-2 border-b border-border/60 bg-muted/20 px-4">
                          {section.icon ? (
                            <section.icon className="size-3.5 text-muted-foreground" />
                          ) : section.dotColor ? (
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: section.dotColor }}
                            />
                          ) : (
                            <span className={cn("size-2 rounded-full", section.dotClass)} />
                          )}
                          <span className={cn("text-sm font-medium", section.labelClass)}>
                            {section.label}
                          </span>
                          <span className="text-caption text-muted-foreground">
                            {section.tasks.length}
                          </span>
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {[0, 1, 2, 3, 4].map((r) => (
        <div key={r} className={cn(TASK_GRID, "h-11 border-b border-border/60")}>
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ lens }: { lens: Lens }) {
  const heading =
    lens === "today"
      ? "Nothing scheduled for today"
      : lens === "recurring"
        ? "No recurring tasks"
        : lens === "reminders"
          ? "No reminders set"
          : "No tasks here";
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-16 text-center">
      <ListPlus className="size-5 text-muted-foreground" />
      <h2 className="mt-3 text-subheading font-medium">{heading}</h2>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">
        Type in the field above and press Enter to add one — or capture to the Inbox with ⌘N.
      </p>
    </div>
  );
}
