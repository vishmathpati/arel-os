/**
 * AreaPage — an Area's "home" (Chapter 4). Extends the flagship block-page shell
 * (D22): area header (identity icon + inline-editable one-line description) →
 * overview stat band → sub-areas (display-only) → contents grouped by type.
 *
 * Only Tasks exist as entities yet (D26): the Tasks section is live (reuses the
 * flagship TaskRow + inline-expand, filtered to this area); Quests / Projects /
 * Databases / Pages render as labeled shells that auto-fill as Ch 5–8 land.
 */

import { AreaStatBand } from "@/app/areas/area-stat-band";
import { useAreasContext } from "@/app/areas/areas-provider";
import { NewSubAreaDialog } from "@/app/areas/new-sub-area-dialog";
import { useArea } from "@/app/areas/use-area";
import { AreaDatabasesSection } from "@/app/databases/area-databases-section";
import { ResourcesSection } from "@/app/databases/resources-section";
import { PageBody } from "@/app/editor/page-body";
import { PageHeader } from "@/app/page-header";
import { PROJECT_GRID, ProjectRow } from "@/app/projects/project-row";
import { useProjects } from "@/app/projects/use-projects";
import { NewQuestDialog } from "@/app/quests/new-quest-dialog";
import { QUEST_GRID, QuestRow } from "@/app/quests/quest-row";
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
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { areaSlug, areaWikilink } from "@/shared/lib/areas";
import type { Project } from "@/shared/lib/project-data";
import { isProjectFinished } from "@/shared/lib/projects";
import { isQuestFinished } from "@/shared/lib/quests";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import {
  Archive,
  ArchiveRestore,
  Compass,
  Database,
  FileStack,
  FolderKanban,
  ListTodo,
  type LucideIcon,
  Plus,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function isFinished(t: Task): boolean {
  return t.status === "done" || t.status === "dropped";
}

/** Unfinished first, then newest-created — a quiet, stable order. */
function sortAreaTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const fa = isFinished(a) ? 1 : 0;
    const fb = isFinished(b) ? 1 : 0;
    if (fa !== fb) return fa - fb;
    return (b.created ?? "").localeCompare(a.created ?? "");
  });
}

export function AreaPage() {
  const { area: slugParam = "" } = useParams();
  const slug = slugParam.toLowerCase();
  const navigate = useNavigate();
  const {
    area,
    subAreas,
    loading,
    notFound,
    error,
    reload,
    saveName,
    saveDescription,
    saveBody,
    archive,
    addSubArea,
  } = useArea(slug);
  const { reload: reloadAreasNav } = useAreasContext();
  const tasksApi = useTasks();
  const projectsApi = useProjects();
  const questsApi = useQuests();
  const [draft, setDraft] = useState("");
  const [projectDraft, setProjectDraft] = useState("");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const toggleExpand = useCallback(
    (task: Task) => setExpandedPath((prev) => (prev === task.path ? null : task.path)),
    [],
  );

  const Icon = area?.icon ?? Compass;
  const color = area?.color ?? null;

  const handleArchiveToggle = useCallback(async () => {
    if (!area) return;
    await archive(!area.archived);
    reloadAreasNav();
  }, [area, archive, reloadAreasNav]);

  const handleRename = useCallback(
    async (name: string) => {
      await saveName(name);
      reloadAreasNav();
    },
    [saveName, reloadAreasNav],
  );

  // Roll-up: include items filed to sub-areas in this parent's view.
  // slugSet = { parentSlug, subArea1Slug, subArea2Slug, … }
  const slugSet = useMemo(() => new Set([slug, ...subAreas.map((s) => s.slug)]), [slug, subAreas]);

  const areaTasks = useMemo(
    () => sortAreaTasks(tasksApi.tasks.filter((t) => slugSet.has(areaSlug(t.area) ?? ""))),
    [tasksApi.tasks, slugSet],
  );
  const openTaskCount = areaTasks.filter((t) => !isFinished(t)).length;

  const areaProjects = useMemo(
    () =>
      [...projectsApi.projects.filter((p) => slugSet.has(areaSlug(p.area) ?? ""))].sort(
        (a: Project, b: Project) => (a.title ?? "").localeCompare(b.title ?? ""),
      ),
    [projectsApi.projects, slugSet],
  );
  const openProjectCount = areaProjects.filter((p) => !isProjectFinished(p.status)).length;

  const areaQuests = useMemo(
    () =>
      [...questsApi.quests.filter((qq) => slugSet.has(areaSlug(qq.area) ?? ""))].sort((a, b) =>
        (a.deadline ?? "").localeCompare(b.deadline ?? ""),
      ),
    [questsApi.quests, slugSet],
  );
  const openQuestCount = areaQuests.filter((qq) => !isQuestFinished(qq.status)).length;
  const questOptions = useMemo(
    () => areaQuests.map((qq) => ({ slug: qq.slug, title: qq.title ?? qq.slug, area: slug })),
    [areaQuests, slug],
  );

  const submitDraft = useCallback(async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    await tasksApi.create({ title, schedule: "unscheduled", area: areaWikilink(slug) });
  }, [draft, slug, tasksApi]);

  const submitProjectDraft = useCallback(async () => {
    const title = projectDraft.trim();
    if (!title) return;
    setProjectDraft("");
    await projectsApi.create({ title, area: slug });
  }, [projectDraft, slug, projectsApi]);

  if (loading) {
    return (
      <Shell crumbLabel={area?.name ?? "Area"}>
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-3 h-4 w-80" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[4.75rem] rounded-lg" />
          ))}
        </div>
      </Shell>
    );
  }

  if (notFound || !area) {
    return (
      <Shell crumbLabel="Area">
        <Alert>
          <AlertTitle>Area not found</AlertTitle>
          <AlertDescription>
            “{slug}” isn’t one of your areas. Pick one from the sidebar.
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  return (
    <Shell crumbLabel={area.name}>
      {/* Area header — identity icon + inline-editable name/description + archive */}
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card"
          style={{ color: color ?? undefined }}
        >
          <Icon className="size-5" />
        </span>
        {/* The one-line description is the area's frontmatter tagline (stays). Per
            BRIEF D29 the Area also gets a full Plate editor body + subpages in Ch7. */}
        <div className="min-w-0 flex-1">
          <InlineTitle value={area.name} onSave={handleRename} />
          <InlineDescription value={area.description} onSave={saveDescription} />
        </div>
        {!area.parent && (
          <Button variant="outline" size="sm" onClick={() => setConfirmArchive(true)}>
            {area.archived ? (
              <>
                <ArchiveRestore className="size-4" />
                Restore
              </>
            ) : (
              <>
                <Archive className="size-4" />
                Archive
              </>
            )}
          </Button>
        )}
      </div>

      {area.archived && (
        <Alert className="mt-4">
          <AlertTitle>This area is archived</AlertTitle>
          <AlertDescription>
            It's hidden from the sidebar. Restore it to file new items here again.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6">
        <AreaStatBand
          counts={{
            quests: openQuestCount,
            projects: openProjectCount,
            tasks: openTaskCount,
            resources: 0,
          }}
        />
      </div>

      {/* Sub-areas section — show on top-level areas only (2-level max rule). */}
      {!area.parent && (
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <SectionLabel>Sub-areas</SectionLabel>
            <NewSubAreaDialog parentName={area.name} onCreate={addSubArea} />
          </div>
          {subAreas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {subAreas.map((sub) => (
                <Button
                  key={sub.slug}
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/areas/${sub.slug}`)}
                >
                  {sub.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Page body — Plate editor + subpages (D29). The area IS a Page. */}
      <div className="mt-8">
        <PageBody
          parentSlug={slug}
          body={area.body}
          onSaveBody={saveBody}
          inheritArea={slug}
          placeholder="Notes for this area — context, links, anything…"
        />
      </div>

      {/* Tasks — the one live content type (D26) */}
      <ContentSection icon={ListTodo} title="Tasks" count={openTaskCount} className="mt-8">
        <div className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4">
          <Plus className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitDraft()}
            placeholder={`Add a task to ${area.name}…`}
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="mt-3">
          {tasksApi.loading ? (
            <LoadingTable />
          ) : tasksApi.error ? (
            <Alert variant="destructive">
              <AlertTitle>Couldn't load tasks</AlertTitle>
              <AlertDescription>{tasksApi.error}</AlertDescription>
              <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={tasksApi.reload}>
                Retry
              </Button>
            </Alert>
          ) : areaTasks.length === 0 ? (
            <EmptyShell icon={ListTodo} label="No tasks in this area yet." />
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
              {areaTasks.map((task) => (
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
                  projectOptions={areaProjects.map((p) => ({
                    slug: p.slug,
                    title: p.title ?? p.slug,
                    area: slug,
                  }))}
                  questOptions={questOptions}
                />
              ))}
            </div>
          )}
        </div>
      </ContentSection>

      {/* Shells — auto-fill as Ch 5–8 land */}
      <ContentSection icon={Compass} title="Quests" count={openQuestCount} className="mt-8">
        <div className="mb-3 flex justify-end">
          <NewQuestDialog defaultArea={slug} onCreate={questsApi.create} />
        </div>
        {questsApi.loading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : areaQuests.length === 0 ? (
          <EmptyShell icon={Compass} label="No quests in this area yet." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div
              className={cn(
                QUEST_GRID,
                "h-8 border-b border-border text-caption text-muted-foreground",
              )}
            >
              <span>Quest</span>
              <span>Status</span>
              <span>Area</span>
              <span>Deadline</span>
              <span>Focus</span>
            </div>
            {areaQuests.map((qq) => (
              <QuestRow key={qq.path} quest={qq} />
            ))}
          </div>
        )}
      </ContentSection>
      <ContentSection
        icon={FolderKanban}
        title="Projects"
        count={openProjectCount}
        className="mt-8"
      >
        <div className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4">
          <Plus className="size-4 shrink-0 text-muted-foreground" />
          <Input
            value={projectDraft}
            onChange={(e) => setProjectDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitProjectDraft()}
            placeholder={`Add a project to ${area.name}…`}
            className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <div className="mt-3">
          {projectsApi.loading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : areaProjects.length === 0 ? (
            <EmptyShell icon={FolderKanban} label="No projects in this area yet." />
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
              {areaProjects.map((p) => (
                <ProjectRow key={p.path} project={p} />
              ))}
            </div>
          )}
        </div>
      </ContentSection>
      <ContentSection icon={Database} title="Databases" count={0} className="mt-8">
        <AreaDatabasesSection areaSlug={slug} />
      </ContentSection>

      <ContentSection icon={FileStack} title="Resources" count={0} className="mt-8">
        <ResourcesSection filter={{ area: slug }} />
      </ContentSection>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
            Retry
          </Button>
        </Alert>
      )}

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {area.archived ? "Restore this area?" : "Archive this area?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {area.archived
                ? `“${area.name}” will reappear in the sidebar.`
                : `“${area.name}” will be hidden from the sidebar. Anything filed to it stays put — you can restore it later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              autoFocus
              onClick={() => {
                setConfirmArchive(false);
                handleArchiveToggle();
              }}
            >
              {area.archived ? "Restore" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}

function Shell({ crumbLabel, children }: { crumbLabel: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Areas" }, { label: crumbLabel }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-caption font-medium text-muted-foreground">{children}</span>;
}

function ContentSection({
  icon: Icon,
  title,
  count,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  count: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h2 className="text-subheading font-medium">{title}</h2>
        <span className="text-caption tabular-nums text-muted-foreground">{count}</span>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyShell({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-10 text-center">
      <Icon className="size-5 text-muted-foreground" />
      <p className="mt-2 text-body text-muted-foreground">{label}</p>
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {[0, 1, 2].map((r) => (
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

/** Click-to-edit area name (the h1). Enter/blur saves; Esc cancels; empty is a no-op. */
function InlineTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim()) onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="h-9 border-0 bg-transparent px-0 text-heading font-semibold leading-tight shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="block cursor-text text-left text-heading font-semibold leading-tight transition-colors hover:text-foreground/80"
    >
      {value}
    </button>
  );
}

/** Click-to-edit one-line description. Enter/blur saves; Esc cancels. */
function InlineDescription({
  value,
  onSave,
}: {
  value: string;
  onSave: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          onSave(draft.trim());
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder="Add a description…"
        className="mt-1 h-7 max-w-xl border-0 bg-transparent px-0 text-body text-muted-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="mt-1 block max-w-xl cursor-text text-left text-body text-muted-foreground transition-colors hover:text-foreground"
    >
      {value || <span className="text-muted-foreground/50">Add a description…</span>}
    </button>
  );
}
