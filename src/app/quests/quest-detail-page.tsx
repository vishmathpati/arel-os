/**
 * QuestDetailPage — copies the locked block-detail sub-template (D28) via the
 * shared detail-kit, plus quest-specifics: deadline + Focus + target in the
 * header, a deadline Review (Done/Roll/Drop), a Milestones checklist, a Projects
 * section (create-under-quest + assign existing), and a Loose-tasks section.
 * Body = Notes (Plate placeholder, D29). Ending a quest demotes its unfinished
 * projects (D30, handled in the data layer).
 */

import { ResourcesSection } from "@/app/databases/resources-section";
import {
  DetailShell,
  Field,
  InlineTitle,
  PILL_BASE,
  PILL_OFF,
  PILL_ON,
} from "@/app/detail/detail-kit";
import { PageBody } from "@/app/editor/page-body";
import { PROJECT_GRID, ProjectRow, formatDue } from "@/app/projects/project-row";
import { useProjects } from "@/app/projects/use-projects";
import { isQuestOverdue } from "@/app/quests/quest-row";
import { useQuest } from "@/app/quests/use-quest";
import { TASK_GRID, TaskRow } from "@/app/tasks/task-row";
import { useTasks } from "@/app/tasks/use-tasks";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
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
import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { areaColor, areaLabel, areaSlug } from "@/shared/lib/areas";
import { isProjectFinished } from "@/shared/lib/projects";
import { QUEST_STATUS_ORDER } from "@/shared/lib/quests";
import { toDateStr } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { QuestStatus } from "@/shared/lib/vault/schemas";
import {
  CalendarClock,
  Check,
  FileStack,
  FolderKanban,
  Plus,
  Star,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function isTaskFinished(t: Task): boolean {
  return t.status === "done" || t.status === "dropped";
}

function selectedDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

export function QuestDetailPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const q = useQuest(slug);
  const projectsApi = useProjects();
  const tasksApi = useTasks();

  const [milestoneDraft, setMilestoneDraft] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [taskDraft, setTaskDraft] = useState("");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rollOpen, setRollOpen] = useState(false);

  const quest = q.quest;
  const questAreaSlug = quest ? (areaSlug(quest.area) ?? "") : "";

  const questProjects = useMemo(
    () =>
      projectsApi.projects
        .filter((p) => p.quest && wikiTarget(p.quest) === slug)
        .sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "")),
    [projectsApi.projects, slug],
  );
  const assignable = useMemo(
    () =>
      projectsApi.projects.filter(
        (p) => areaSlug(p.area) === questAreaSlug && !p.quest && !isProjectFinished(p.status),
      ),
    [projectsApi.projects, questAreaSlug],
  );
  const looseTasks = useMemo(
    () =>
      tasksApi.tasks
        .filter((t) => t.quest && wikiTarget(t.quest) === slug && !t.project)
        .sort((a, b) => {
          const fa = isTaskFinished(a) ? 1 : 0;
          const fb = isTaskFinished(b) ? 1 : 0;
          if (fa !== fb) return fa - fb;
          return (b.created ?? "").localeCompare(a.created ?? "");
        }),
    [tasksApi.tasks, slug],
  );

  const toggleExpand = useCallback(
    (task: Task) => setExpandedPath((prev) => (prev === task.path ? null : task.path)),
    [],
  );

  const addProject = useCallback(async () => {
    const title = projectDraft.trim();
    if (!title || !quest) return;
    setProjectDraft("");
    await projectsApi.create({ title, area: questAreaSlug, quest: toWikilink(slug) });
  }, [projectDraft, quest, questAreaSlug, slug, projectsApi]);

  const addTask = useCallback(async () => {
    const title = taskDraft.trim();
    if (!title || !quest) return;
    setTaskDraft("");
    await tasksApi.create({
      title,
      schedule: "unscheduled",
      area: quest.area,
      quest: toWikilink(slug),
    });
  }, [taskDraft, quest, slug, tasksApi]);

  if (q.loading) {
    return (
      <DetailShell crumbs={[{ label: "Quests" }, { label: "Quest" }]}>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-40" />
        <Skeleton className="mt-6 h-24 w-full rounded-lg" />
      </DetailShell>
    );
  }

  if (q.notFound || !quest) {
    return (
      <DetailShell crumbs={[{ label: "Quests" }, { label: "Quest" }]}>
        <Alert>
          <AlertTitle>Quest not found</AlertTitle>
          <AlertDescription>
            This quest doesn’t exist or was archived.{" "}
            <button type="button" className="underline" onClick={() => navigate("/quests")}>
              Back to quests
            </button>
            .
          </AlertDescription>
        </Alert>
      </DetailShell>
    );
  }

  const area = areaLabel(quest.area);
  const color = areaColor(quest.area);
  const deadline = formatDue(quest.deadline);
  const overdue = isQuestOverdue(quest);
  const milestones = quest.milestones ?? [];
  const reached = milestones.filter((m) => m.reached).length;

  return (
    <DetailShell crumbs={[{ label: "Quests" }, { label: quest.title || "Untitled" }]}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <InlineTitle value={quest.title ?? ""} onSave={(t) => q.patch({ title: t })} />
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
            {area && (
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: color ?? "var(--color-muted-foreground)" }}
                />
                {area}
              </span>
            )}
            {quest.focus && (
              <span className="flex items-center gap-1 text-warning">
                <Star className="size-3.5 fill-warning" />
                This week's focus
              </span>
            )}
            {quest.target && <span>🎯 {quest.target}</span>}
            {overdue && (
              <span className="flex items-center gap-1 text-error">
                <TriangleAlert className="size-3.5" />
                Overdue
              </span>
            )}
          </div>
        </div>
        {overdue && (
          <Button variant="outline" size="sm" onClick={() => setReviewOpen(true)}>
            Review
          </Button>
        )}
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3.5">
        <Field label="Status">
          {QUEST_STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => q.setStatus(s as QuestStatus)}
              className={cn(PILL_BASE, quest.status === s ? PILL_ON : PILL_OFF, "capitalize")}
            >
              {s}
            </button>
          ))}
        </Field>

        <Field label="Deadline">
          <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  PILL_BASE,
                  PILL_OFF,
                  "flex items-center gap-1.5",
                  overdue && "text-error",
                )}
              >
                <CalendarClock className="size-3.5" />
                {deadline ?? "Set a deadline"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <Calendar
                mode="single"
                selected={selectedDate(quest.deadline)}
                onSelect={(date) => {
                  if (date) q.patch({ deadline: toDateStr(date) });
                  setDeadlineOpen(false);
                }}
                className="p-0"
              />
            </PopoverContent>
          </Popover>
        </Field>

        <Field label="Focus">
          <button
            type="button"
            onClick={() => q.toggleFocus()}
            className={cn(
              PILL_BASE,
              "flex items-center gap-1.5",
              quest.focus ? "border-transparent bg-warning/15 text-warning" : PILL_OFF,
            )}
          >
            <Star className={cn("size-3.5", quest.focus && "fill-warning")} />
            {quest.focus ? "This week" : "Set focus"}
          </button>
        </Field>

        <Field label="Target">
          <Input
            defaultValue={quest.target ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (quest.target ?? "")) q.patch({ target: v || undefined });
            }}
            placeholder="e.g. read 12 books (optional)"
            className="h-8 max-w-sm text-caption"
          />
        </Field>
      </div>

      {/* Page body — Plate editor + subpages (D29). The quest IS a Page. */}
      <div className="mt-6">
        <PageBody
          parentSlug={quest.slug}
          body={quest.notes}
          onSaveBody={q.saveNotes}
          inheritArea={questAreaSlug || undefined}
          placeholder="What is this quest? The why, the plan, the stakes…"
        />
      </div>

      {/* Milestones */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <h2 className="text-subheading font-medium">Milestones</h2>
          <span className="text-caption tabular-nums text-muted-foreground">
            {reached}/{milestones.length}
          </span>
        </div>
        <div className="mt-3 rounded-lg border border-border bg-card">
          {milestones.map((m, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: order is the milestone identity.
              key={i}
              className="group/m flex items-center gap-2.5 border-b border-border/60 px-4 py-2.5 last:border-b-0"
            >
              <Checkbox checked={m.reached} onCheckedChange={() => q.toggleMilestoneAt(i)} />
              <span
                className={cn(
                  "flex-1 text-body",
                  m.reached && "text-muted-foreground line-through",
                )}
              >
                {m.title}
              </span>
              <button
                type="button"
                onClick={() => q.removeMilestoneAt(i)}
                className="text-muted-foreground/60 opacity-0 hover:text-foreground group-hover/m:opacity-100"
                aria-label="Remove milestone"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <Plus className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              value={milestoneDraft}
              onChange={(e) => setMilestoneDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && milestoneDraft.trim()) {
                  q.addMilestoneTitle(milestoneDraft.trim());
                  setMilestoneDraft("");
                }
              }}
              placeholder="Add a milestone…"
              className="h-7 border-0 bg-transparent px-0 text-body shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-subheading font-medium">Projects</h2>
            <span className="text-caption tabular-nums text-muted-foreground">
              {questProjects.length}
            </span>
          </div>
          {assignable.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Add existing
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1">
                {assignable.map((p) => (
                  <button
                    key={p.path}
                    type="button"
                    onClick={() => projectsApi.patch(p, { quest: toWikilink(slug) })}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body hover:bg-hover"
                  >
                    <FolderKanban className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{p.title || p.slug}</span>
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </div>

        <div className="mt-3 flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4">
          <Plus className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={projectDraft}
            onChange={(e) => setProjectDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addProject()}
            placeholder="Add a project to this quest…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="mt-3">
          {questProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-8 text-center">
              <p className="text-body text-muted-foreground">
                No projects in this quest yet. Add one above, or assign an existing one.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div
                className={cn(
                  PROJECT_GRID,
                  "h-8 border-b border-border text-caption text-muted-foreground",
                )}
              >
                <span>Project</span>
                <span>Status</span>
                <span>Context</span>
                <span>Kind</span>
                <span>Due</span>
              </div>
              {questProjects.map((p) => (
                <ProjectRow key={p.path} project={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Loose tasks */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <h2 className="text-subheading font-medium">Loose tasks</h2>
          <span className="text-caption tabular-nums text-muted-foreground">
            {looseTasks.filter((t) => !isTaskFinished(t)).length}
          </span>
        </div>
        <p className="mt-1 text-caption text-muted-foreground">
          Tasks under this quest directly — not inside one of its projects.
        </p>

        <div className="mt-3 flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4">
          <Plus className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={taskDraft}
            onChange={(e) => setTaskDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addTask()}
            placeholder="Add a loose task to this quest…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="mt-3">
          {looseTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-8 text-center">
              <p className="text-body text-muted-foreground">
                No loose tasks. Most work lives in projects.
              </p>
            </div>
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
              {looseTasks.map((task) => (
                <TaskRow
                  key={task.path}
                  task={task}
                  expanded={expandedPath === task.path}
                  onToggleExpand={toggleExpand}
                  onToggleDone={tasksApi.toggleDone}
                  onPatch={tasksApi.patch}
                  onSetStatus={tasksApi.setStatus}
                  onReschedule={tasksApi.reschedule}
                  onDelete={tasksApi.remove}
                  projectOptions={questProjects.map((p) => ({
                    slug: p.slug,
                    title: p.title ?? p.slug,
                    area: questAreaSlug,
                  }))}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Resources — a filtered view of the Library (Ch8) */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <FileStack className="size-4 text-muted-foreground" />
          <h2 className="text-subheading font-medium">Resources</h2>
        </div>
        <div className="mt-3">
          <ResourcesSection filter={{ quest: slug }} />
        </div>
      </section>

      {/* Delete */}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-1.5 text-caption text-error hover:underline"
        >
          <Trash2 className="size-3.5" />
          Delete quest
        </button>
      </div>

      {q.error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{q.error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={q.reload}>
            Retry
          </Button>
        </Alert>
      )}

      {/* Deadline review (Done / Roll over / Drop) */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>This quest is past its deadline</DialogTitle>
            <DialogDescription>
              “{quest.title || "Untitled"}” was due {deadline}. What do you want to do?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => {
                q.setStatus("done");
                setReviewOpen(false);
              }}
            >
              <Check className="size-4 text-success" />
              Hit it — mark Done
            </Button>
            <Popover open={rollOpen} onOpenChange={setRollOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start gap-2">
                  <CalendarClock className="size-4" />
                  Still want it — roll over to a new deadline
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-2">
                <Calendar
                  mode="single"
                  selected={selectedDate(quest.deadline)}
                  onSelect={(date) => {
                    if (date) q.rollOver(toDateStr(date));
                    setRollOpen(false);
                    setReviewOpen(false);
                  }}
                  className="p-0"
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              className="justify-start gap-2 text-error"
              onClick={() => {
                q.setStatus("dropped");
                setReviewOpen(false);
              }}
            >
              <X className="size-4" />
              Don't want it — Drop
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quest?</AlertDialogTitle>
            <AlertDialogDescription>
              “{quest.title || "Untitled"}” will be moved to the archive. Its projects and tasks
              stay in the vault. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              autoFocus
              onClick={async () => {
                setConfirmOpen(false);
                if (await q.remove()) navigate("/quests");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailShell>
  );
}
