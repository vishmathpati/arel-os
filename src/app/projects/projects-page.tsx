/**
 * ProjectsPage — the global project list on the flagship block-page shell (D22):
 * status stat band → toolbar (lens pills + Group-by) → one contained table with
 * aligned columns (Project · Status · Context · Kind · Due). Flat by default;
 * grouping is opt-in. Rows navigate to the detail page (no inline-expand here).
 * Creation is the New-project dialog (area is required, so a picker is needed).
 */

import { PageHeader } from "@/app/page-header";
import { NewProjectDialog } from "@/app/projects/new-project-dialog";
import { PROJECT_GRID, ProjectRow } from "@/app/projects/project-row";
import { useProjects } from "@/app/projects/use-projects";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AREA_OPTIONS, areaSlug } from "@/shared/lib/areas";
import type { Project } from "@/shared/lib/project-data";
import { PROJECT_STATUS_META, PROJECT_STATUS_ORDER } from "@/shared/lib/projects";
import { cn } from "@/shared/lib/utils";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { ProjectStatus } from "@/shared/lib/vault/schemas";
import { Code2, Compass, FolderKanban, ListChecks, type LucideIcon } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

type Lens = "active" | "backlog" | "paused" | "done" | "all";
type GroupBy = "none" | "area" | "status" | "quest" | "kind";

const LENSES: ReadonlyArray<{ key: Lens; label: string }> = [
  { key: "active", label: "Active" },
  { key: "backlog", label: "Backlog" },
  { key: "paused", label: "Paused" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

const LENS_STATUSES: Record<Exclude<Lens, "all">, readonly ProjectStatus[]> = {
  active: ["active"],
  backlog: ["backlog"],
  paused: ["paused", "waiting"],
  done: ["done", "dropped"],
};

interface StatDef {
  key: Lens;
  label: string;
  icon: LucideIcon;
  statuses: readonly ProjectStatus[];
}
const STATS: readonly StatDef[] = [
  { key: "active", label: "Active", icon: ListChecks, statuses: ["active"] },
  { key: "backlog", label: "Backlog", icon: FolderKanban, statuses: ["backlog"] },
  { key: "paused", label: "Paused", icon: Compass, statuses: ["paused", "waiting"] },
  { key: "done", label: "Done", icon: Code2, statuses: ["done", "dropped"] },
];

function prettyStem(stem: string): string {
  return stem.charAt(0).toUpperCase() + stem.slice(1).replace(/-/g, " ");
}

function byTitle(a: Project, b: Project): number {
  return (a.title ?? "").localeCompare(b.title ?? "");
}

interface Section {
  key: string;
  label: string;
  dotClass?: string;
  dotColor?: string;
  icon?: LucideIcon;
  labelClass?: string;
  projects: Project[];
}

function filterByLens(projects: Project[], lens: Lens): Project[] {
  if (lens === "all") return projects;
  const allowed = LENS_STATUSES[lens];
  return projects.filter((p) => allowed.includes(p.status));
}

function statusSections(projects: Project[]): Section[] {
  return PROJECT_STATUS_ORDER.map((s) => ({
    key: s,
    label: PROJECT_STATUS_META[s].label,
    dotClass: PROJECT_STATUS_META[s].dotClass,
    labelClass: PROJECT_STATUS_META[s].labelClass,
    projects: projects.filter((p) => p.status === s).sort(byTitle),
  })).filter((sec) => sec.projects.length > 0);
}

function areaSections(projects: Project[]): Section[] {
  const sections: Section[] = [];
  for (const a of AREA_OPTIONS) {
    const inArea = projects.filter((p) => areaSlug(p.area) === a.slug).sort(byTitle);
    if (inArea.length) {
      sections.push({ key: a.slug, label: a.label, dotColor: a.color, projects: inArea });
    }
  }
  return sections;
}

function linkSections(projects: Project[]): Section[] {
  const byKey = new Map<string, Project[]>();
  for (const p of projects) {
    const key = p.quest ? wikiTarget(p.quest) : "__none__";
    (byKey.get(key) ?? byKey.set(key, []).get(key))?.push(p);
  }
  const sections: Section[] = [...byKey.keys()]
    .filter((k) => k !== "__none__")
    .sort()
    .map((key) => ({
      key,
      label: prettyStem(key),
      icon: Compass,
      projects: byKey.get(key)?.sort(byTitle) ?? [],
    }));
  if (byKey.has("__none__")) {
    sections.push({
      key: "__none__",
      label: "No quest",
      dotClass: "bg-muted-foreground/40",
      projects: byKey.get("__none__")?.sort(byTitle) ?? [],
    });
  }
  return sections;
}

function kindSections(projects: Project[]): Section[] {
  return (["software", "standard"] as const)
    .map((k) => ({
      key: k,
      label: k === "software" ? "Software" : "Standard",
      icon: k === "software" ? Code2 : FolderKanban,
      projects: projects.filter((p) => p.kind === k).sort(byTitle),
    }))
    .filter((sec) => sec.projects.length > 0);
}

export function ProjectsPage() {
  const { projects, loading, error, reload, create } = useProjects();
  const [lens, setLens] = useState<Lens>("active");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STATS) c[s.key] = projects.filter((p) => s.statuses.includes(p.status)).length;
    return c;
  }, [projects]);

  const filtered = useMemo(() => filterByLens(projects, lens), [projects, lens]);
  const flat = useMemo(
    () => (groupBy === "none" ? [...filtered].sort(byTitle) : null),
    [filtered, groupBy],
  );
  const sections = useMemo(() => {
    switch (groupBy) {
      case "area":
        return areaSections(filtered);
      case "status":
        return statusSections(filtered);
      case "quest":
        return linkSections(filtered);
      case "kind":
        return kindSections(filtered);
      default:
        return [];
    }
  }, [filtered, groupBy]);

  const isEmpty = groupBy === "none" ? (flat?.length ?? 0) === 0 : sections.length === 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Projects" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {/* Stat band */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STATS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setLens(key)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-hover",
                  lens === key ? "border-foreground/30" : "border-border",
                )}
              >
                <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
                  <Icon className="size-4" />
                  {label}
                </span>
                <span className="text-2xl font-semibold tabular-nums">{counts[key] ?? 0}</span>
              </button>
            ))}
          </div>

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
                  <SelectItem value="area">Area</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="quest">Quest</SelectItem>
                  <SelectItem value="kind">Kind</SelectItem>
                </SelectContent>
              </Select>
              <NewProjectDialog onCreate={create} />
            </div>
          </div>

          {/* Table */}
          <div className="mt-4">
            {loading ? (
              <LoadingTable />
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn't load projects</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
                  Retry
                </Button>
              </Alert>
            ) : isEmpty ? (
              <EmptyState lens={lens} onCreate={create} />
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
                {groupBy === "none"
                  ? flat?.map((p) => <ProjectRow key={p.path} project={p} />)
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
                            {section.projects.length}
                          </span>
                        </div>
                        {section.projects.map((p) => (
                          <ProjectRow key={p.path} project={p} />
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
      {[0, 1, 2, 3].map((r) => (
        <div key={r} className={cn(PROJECT_GRID, "h-11 border-b border-border/60")}>
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-8" />
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  lens,
  onCreate,
}: {
  lens: Lens;
  onCreate: (input: import("@/shared/lib/project-data").CreateProjectInput) => Promise<unknown>;
}) {
  const heading = lens === "all" ? "No projects yet" : `No ${lens} projects`;
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-16 text-center">
      <FolderKanban className="size-5 text-muted-foreground" />
      <h2 className="mt-3 text-subheading font-medium">{heading}</h2>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">
        Projects are multi-step work, each living in one area. Use New project to add one.
      </p>
      <div className="mt-4">
        <NewProjectDialog onCreate={onCreate} />
      </div>
    </div>
  );
}
