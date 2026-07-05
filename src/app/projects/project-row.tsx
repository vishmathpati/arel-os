/**
 * ProjectRow — one row of the flagship project table. Columns align via the
 * shared PROJECT_GRID (same technique as TASK_GRID). Clicking the row navigates
 * to the project detail page — there is no inline-expand here (a project's body
 * is a description + task list, too much for a row; that lives on the detail
 * page, the locked Ch5 detail sub-template).
 */

import { areaColor, areaLabel } from "@/shared/lib/areas";
import type { Project } from "@/shared/lib/project-data";
import { PROJECT_STATUS_META } from "@/shared/lib/projects";
import { cn } from "@/shared/lib/utils";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import { Code2, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";

/** Shared column grid — used by every row AND the table's column header. */
export const PROJECT_GRID =
  "grid grid-cols-[minmax(0,1fr)_7rem_minmax(0,12rem)_4.5rem_5.5rem] items-center gap-3 px-4";

function linkLabel(link: string): string {
  const stem = wikiTarget(link);
  return stem.charAt(0).toUpperCase() + stem.slice(1).replace(/-/g, " ");
}

/** Short date like "Jun 20"; returns null for no due date. */
export function formatDue(due: string | undefined): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return due;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusCell({ status }: { status: Project["status"] }) {
  const meta = PROJECT_STATUS_META[status];
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-caption">
      <span className={cn("size-1.5 shrink-0 rounded-full", meta.dotClass)} />
      <span className={cn("truncate", meta.labelClass ?? "text-muted-foreground")}>
        {meta.label}
      </span>
    </span>
  );
}

function ContextCell({ project }: { project: Project }) {
  const area = areaLabel(project.area);
  const color = areaColor(project.area);
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-caption text-muted-foreground">
      {area ? (
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color ?? "var(--color-muted-foreground)" }}
          />
          <span className="truncate">{area}</span>
        </span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      )}
      {project.quest && (
        <span className="flex min-w-0 items-center gap-1" title="Quest">
          <Compass className="size-3 shrink-0" />
          <span className="truncate">{linkLabel(project.quest)}</span>
        </span>
      )}
    </div>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  const navigate = useNavigate();
  const due = formatDue(project.due);
  const finished = project.status === "done" || project.status === "dropped";

  return (
    <button
      type="button"
      onClick={() => navigate(`/projects/${project.slug}`)}
      className={cn(
        PROJECT_GRID,
        "h-11 w-full cursor-pointer border-b border-border/60 text-left transition-colors hover:bg-hover",
      )}
    >
      <span
        className={cn(
          "min-w-0 truncate text-body",
          finished && "text-muted-foreground line-through",
        )}
      >
        {project.title || "Untitled"}
      </span>
      <StatusCell status={project.status} />
      <ContextCell project={project} />
      <span className="text-caption text-muted-foreground">
        {project.kind === "software" ? (
          <span className="inline-flex items-center gap-1 font-mono" title="Software project">
            <Code2 className="size-3.5" />
          </span>
        ) : null}
      </span>
      <span className="text-caption text-muted-foreground">{due ?? ""}</span>
    </button>
  );
}
