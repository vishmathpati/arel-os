/**
 * ProjectDetailPage — the locked block-detail sub-template (D28), composed from
 * the shared detail-kit (Quests reuses the same kit). Header (inline title · area
 * dot · quest link · status pills · kind toggle · due) → Notes body → Tasks
 * section (flagship TaskRow + inline-expand + project-scoped quick-add) →
 * soft-delete.
 *
 * NOTE (BRIEF D29): a Project IS a Page — the Notes body is the editor body.
 * The kit's InlineNotes is a PLACEHOLDER; Ch7 swaps it for the Plate editor.
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
import { ProjectDashboard } from "@/app/projects/dashboard/project-dashboard";
import { LinkRepoDialog } from "@/app/projects/link-repo-dialog";
import { formatDue } from "@/app/projects/project-row";
import { useProject } from "@/app/projects/use-project";
import { useQuests } from "@/app/quests/use-quests";
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
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { areaColor, areaLabel, areaSlug } from "@/shared/lib/areas";
import { PROJECT_STATUS_ORDER } from "@/shared/lib/projects";
import { isQuestFinished } from "@/shared/lib/quests";
import { toDateStr } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { ProjectKind, ProjectStatus } from "@/shared/lib/vault/schemas";
import { CalendarClock, Code2, Compass, FileStack, FolderGit2, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function isFinished(t: Task): boolean {
  return t.status === "done" || t.status === "dropped";
}

function selectedDate(due: string | undefined): Date | undefined {
  if (!due) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(due);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}

export function ProjectDetailPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const {
    project,
    loading,
    notFound,
    error,
    reload,
    patch,
    setStatus,
    setKind,
    saveDescription,
    remove,
  } = useProject(slug);
  const tasksApi = useTasks();
  const { quests } = useQuests();

  const [draft, setDraft] = useState("");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dueOpen, setDueOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const toggleExpand = useCallback(
    (task: Task) => setExpandedPath((prev) => (prev === task.path ? null : task.path)),
    [],
  );

  // Choosing "software" prompts to link the project's folder (D64) when none is set.
  const chooseKind = useCallback(
    (k: ProjectKind) => {
      setKind(k);
      if (k === "software" && !project?.repo_path) setLinkOpen(true);
    },
    [setKind, project?.repo_path],
  );
  const linkRepo = useCallback(
    (path: string) => patch({ repo_path: path, kind: "software" }),
    [patch],
  );

  const projectTasks = useMemo(() => {
    const list = tasksApi.tasks.filter((t) => t.project && wikiTarget(t.project) === slug);
    return [...list].sort((a, b) => {
      const fa = isFinished(a) ? 1 : 0;
      const fb = isFinished(b) ? 1 : 0;
      if (fa !== fb) return fa - fb;
      return (b.created ?? "").localeCompare(a.created ?? "");
    });
  }, [tasksApi.tasks, slug]);

  const submitDraft = useCallback(async () => {
    const title = draft.trim();
    if (!title || !project) return;
    setDraft("");
    await tasksApi.create({
      title,
      schedule: "unscheduled",
      area: project.area,
      project: toWikilink(project.slug),
    });
  }, [draft, project, tasksApi]);

  if (loading) {
    return (
      <DetailShell crumbs={[{ label: "Projects" }, { label: "Project" }]}>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-40" />
        <Skeleton className="mt-6 h-24 w-full rounded-lg" />
      </DetailShell>
    );
  }

  if (notFound || !project) {
    return (
      <DetailShell crumbs={[{ label: "Projects" }, { label: "Project" }]}>
        <Alert>
          <AlertTitle>Project not found</AlertTitle>
          <AlertDescription>
            This project doesn’t exist or was archived.{" "}
            <button type="button" className="underline" onClick={() => navigate("/projects")}>
              Back to projects
            </button>
            .
          </AlertDescription>
        </Alert>
      </DetailShell>
    );
  }

  const area = areaLabel(project.area);
  const color = areaColor(project.area);
  const due = formatDue(project.due);
  const projAreaSlug = areaSlug(project.area);
  const currentQuest = project.quest ? wikiTarget(project.quest) : null;
  const areaQuests = quests.filter(
    (qq) =>
      areaSlug(qq.area) === projAreaSlug &&
      (!isQuestFinished(qq.status) || qq.slug === currentQuest),
  );

  // The Notes/Plate body (D29). Universally lives at the page BOTTOM now (D64);
  // for a linked software project it becomes the dashboard's final "Notes" tab.
  const isLinkedSoftware = project.kind === "software" && Boolean(project.repo_path);
  const notesEditor = (
    <PageBody
      parentSlug={project.slug}
      body={project.description}
      onSaveBody={saveDescription}
      inheritArea={projAreaSlug ?? undefined}
      placeholder="What is this project? Notes, scope, links…"
    />
  );

  return (
    <DetailShell
      crumbs={[{ label: "Projects" }, { label: project.title || "Untitled" }]}
      fullWidth={isLinkedSoftware}
    >
      {/* Header */}
      <div className="min-w-0">
        <InlineTitle value={project.title ?? ""} onSave={(t) => patch({ title: t })} />
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
          {project.quest && (
            <span className="flex items-center gap-1" title="Quest">
              <Compass className="size-3.5" />
              {wikiTarget(project.quest).replace(/-/g, " ")}
            </span>
          )}
          {project.kind === "software" && (
            <span className="flex items-center gap-1 font-mono" title="Software project">
              <Code2 className="size-3.5" />
              software
            </span>
          )}
          {project.demoted && (
            <span className="rounded-md bg-warning/15 px-1.5 py-0.5 text-warning">
              Recently demoted
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-col gap-3.5">
        <Field label="Status">
          {PROJECT_STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s as ProjectStatus)}
              className={cn(PILL_BASE, project.status === s ? PILL_ON : PILL_OFF, "capitalize")}
            >
              {s}
            </button>
          ))}
        </Field>

        <Field label="Kind">
          {(["standard", "software"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => chooseKind(k as ProjectKind)}
              className={cn(PILL_BASE, project.kind === k ? PILL_ON : PILL_OFF, "capitalize")}
            >
              {k}
            </button>
          ))}
        </Field>

        {projAreaSlug && (
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
                  onClick={() => patch({ quest: toWikilink(qq.slug) })}
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
                onClick={() => patch({ quest: undefined })}
                className={cn(PILL_BASE, PILL_OFF)}
              >
                Clear
              </button>
            )}
          </Field>
        )}

        <Field label="Due">
          <Popover open={dueOpen} onOpenChange={setDueOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(PILL_BASE, PILL_OFF, "flex items-center gap-1.5")}
              >
                <CalendarClock className="size-3.5" />
                {due ?? "Set a due date"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <Calendar
                mode="single"
                selected={selectedDate(project.due)}
                onSelect={(date) => {
                  if (date) patch({ due: toDateStr(date) });
                  setDueOpen(false);
                }}
                className="p-0"
              />
            </PopoverContent>
          </Popover>
          {project.due && (
            <button
              type="button"
              onClick={() => patch({ due: undefined })}
              className={cn(PILL_BASE, PILL_OFF)}
            >
              Clear
            </button>
          )}
        </Field>
      </div>

      {/* Tasks */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          <h2 className="text-subheading font-medium">Tasks</h2>
          <span className="text-caption tabular-nums text-muted-foreground">
            {projectTasks.filter((t) => !isFinished(t)).length}
          </span>
        </div>

        <div className="mt-3 flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4">
          <span className="text-muted-foreground">+</span>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitDraft()}
            placeholder="Add a task to this project…"
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="mt-3">
          {tasksApi.loading ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : projectTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-10 text-center">
              <p className="text-body text-muted-foreground">
                No tasks yet. Add the first one above.
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
              {projectTasks.map((task) => (
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
          <ResourcesSection filter={{ project: slug }} />
        </div>
      </section>

      {/* Bottom block (D64): the Notes editor moved here, after Tasks + Resources.
          Software → a tabbed dashboard (Notes is the final tab); standard → just
          the editor. The full project-page redesign is deferred (Vish). */}
      <section className="mt-8">
        {project.kind === "software" ? (
          isLinkedSoftware ? (
            <ProjectDashboard
              slug={project.slug}
              notes={notesEditor}
              onChangeFolder={() => setLinkOpen(true)}
            />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-center">
                <FolderGit2 className="size-5 text-muted-foreground" />
                <p className="mt-3 text-subheading font-medium text-foreground">
                  Link this project's folder
                </p>
                <p className="mt-1 max-w-sm text-caption text-muted-foreground">
                  Point Arel at the project's folder to build its dashboard from its STATUS, BRIEF,
                  ROADMAP and other protocol notes.
                </p>
                <Button size="sm" className="mt-4" onClick={() => setLinkOpen(true)}>
                  <FolderGit2 className="size-4" />
                  Link folder
                </Button>
              </div>
              {notesEditor}
            </div>
          )
        ) : (
          notesEditor
        )}
      </section>

      {/* Delete */}
      <div className="mt-8">
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="flex items-center gap-1.5 text-caption text-error hover:underline"
        >
          <Trash2 className="size-3.5" />
          Delete project
        </button>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
            Retry
          </Button>
        </Alert>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              “{project.title || "Untitled"}” will be moved to the archive. Its tasks stay in the
              vault. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              autoFocus
              onClick={async () => {
                setConfirmOpen(false);
                if (await remove()) navigate("/projects");
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LinkRepoDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        currentPath={project.repo_path}
        onLink={linkRepo}
      />
    </DetailShell>
  );
}
