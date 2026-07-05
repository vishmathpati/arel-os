/**
 * ProjectSyncTable — the project-sync recipe's bespoke surface (D64): every
 * software project with its last-synced time + health, a per-project Run, and a
 * Run all. Per-project Run sends the slug as the run input; Run all runs the
 * recipe with no input (the SKILL syncs every linked project — same as the cron).
 * Reuses the v1.1 run endpoint + scheduler; nothing new to schedule.
 */

import { StatePill } from "@/app/projects/dashboard/dashboard-ui";
import { formatRelTime } from "@/app/recipes/recipe-format";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { runRecipe } from "@/shared/lib/engine/client";
import { readSnapshot } from "@/shared/lib/project-dashboard/client";
import type { ProjectSnapshot } from "@/shared/lib/project-dashboard/snapshot";
import { type Project, listProjects } from "@/shared/lib/project-data";
import { CircleAlert, Loader2, Play } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const RUN_ALL = "__all__";

interface Row {
  project: Project;
  snapshot: ProjectSnapshot | null;
}

export function ProjectSyncTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(null);
    try {
      const projects = await listProjects();
      const software = projects.filter((p) => p.kind === "software" && p.repo_path);
      const withSnaps = await Promise.all(
        software.map(async (project) => ({ project, snapshot: await readSnapshot(project.slug) })),
      );
      setRows(withSnaps);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load software projects");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mark = useCallback((key: string, on: boolean) => {
    setRunning((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const reloadOne = useCallback(async (slug: string) => {
    const snapshot = await readSnapshot(slug);
    setRows((prev) =>
      prev ? prev.map((r) => (r.project.slug === slug ? { ...r, snapshot } : r)) : prev,
    );
  }, []);

  const runOne = useCallback(
    async (slug: string, title: string) => {
      mark(slug, true);
      try {
        const outcome = await runRecipe("project-sync", slug);
        if (outcome.status === "ok") toast.success(`Synced ${title}`);
        else toast.error(`${title}: ${outcome.summary}`);
        await reloadOne(slug);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : `Couldn't sync ${title}`);
      } finally {
        mark(slug, false);
      }
    },
    [mark, reloadOne],
  );

  const runAll = useCallback(async () => {
    mark(RUN_ALL, true);
    try {
      const outcome = await runRecipe("project-sync");
      if (outcome.status === "ok") toast.success("Synced all projects");
      else toast.error(outcome.summary);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't sync");
    } finally {
      mark(RUN_ALL, false);
    }
  }, [load, mark]);

  const anyRunning = running.size > 0;

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-subheading font-medium">Software projects</h2>
          {rows && (
            <span className="text-caption tabular-nums text-muted-foreground">{rows.length}</span>
          )}
        </div>
        <Button size="sm" onClick={runAll} disabled={anyRunning || !rows?.length}>
          {running.has(RUN_ALL) ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Syncing all…
            </>
          ) : (
            <>
              <Play className="size-4" />
              Sync all
            </>
          )}
        </Button>
      </div>
      <p className="mt-1 text-caption text-muted-foreground">
        Each project's dashboard is rebuilt from its protocol notes. Runs daily; sync one now or all
        at once.
      </p>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        {error ? (
          <div className="px-4 py-3">
            <Alert variant="destructive">
              <AlertTitle>Couldn't load projects</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={load}>
                Retry
              </Button>
            </Alert>
          </div>
        ) : !rows ? (
          <div className="flex flex-col divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-7 w-16" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-caption text-muted-foreground">
            No software projects yet. Set a project's kind to “Software” and link its folder to see
            it here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Project</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-40">Last synced</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ project, snapshot }) => {
                const missing = snapshot?.meta.repoPresent === false;
                const isRunning = running.has(project.slug);
                return (
                  <TableRow key={project.slug}>
                    <TableCell className="pl-4 text-body text-foreground">
                      {project.title || project.slug}
                    </TableCell>
                    <TableCell>
                      {missing ? (
                        <span className="flex items-center gap-1 text-caption text-error">
                          <CircleAlert className="size-3" />
                          Folder missing
                        </span>
                      ) : snapshot ? (
                        <StatePill state={snapshot.meta.state} />
                      ) : (
                        <span className="text-caption text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-caption text-muted-foreground">
                      {snapshot?.meta.syncedAt ? formatRelTime(snapshot.meta.syncedAt) : "Never"}
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={anyRunning}
                        onClick={() => runOne(project.slug, project.title || project.slug)}
                      >
                        {isRunning ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Play className="size-3.5" />
                        )}
                        Run
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}
