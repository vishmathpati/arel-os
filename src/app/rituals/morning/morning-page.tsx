/**
 * MorningManifestoPage (Ch10 / D34) — the day's go-to ritual page. Check-in
 * (the seven questions) sits full-width on top; the Today board (everything with
 * a today-state, pulled live) sits below. The daily note is lazy-created on the
 * first "Start your morning" click and reopened on later visits. Autosave is
 * silent. Built entirely from the canonical shells + shadcn primitives.
 */

import { PageHeader } from "@/app/page-header";
import { useProjects } from "@/app/projects/use-projects";
import { useQuests } from "@/app/quests/use-quests";
import { CheckIn } from "@/app/rituals/morning/check-in";
import { type RowProps, TodayBoard } from "@/app/rituals/morning/today-board";
import { useDaily } from "@/app/rituals/morning/use-daily";
import { useTasks } from "@/app/tasks/use-tasks";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { areaSlug } from "@/shared/lib/areas";
import type { Task } from "@/shared/lib/tasks/tasks";
import { buildTodayBundle } from "@/shared/lib/today";
import { cn } from "@/shared/lib/utils";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import { ArrowLeft, CheckCircle2, Sunrise } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const MAX_WINS = 3;

/** "Good morning" before noon, "afternoon" to 5pm, "evening" after. */
function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function MorningManifestoPage() {
  const [searchParams] = useSearchParams();
  const fromOnboarding = searchParams.get("from") === "onboarding";
  const { daily, status, error, start, save, reload } = useDaily();
  const { tasks, loading: tasksLoading, ...taskMutations } = useTasks();
  const { quests } = useQuests();
  const { projects } = useProjects();

  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const now = useMemo(() => new Date(), []);

  const bundle = useMemo(() => buildTodayBundle(tasks, quests, now), [tasks, quests, now]);

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
      quests.map((q) => ({ slug: q.slug, title: q.title ?? q.slug, area: areaSlug(q.area) ?? "" })),
    [quests],
  );

  const toggleExpand = useCallback((task: Task) => {
    setExpandedPath((prev) => (prev === task.path ? null : task.path));
  }, []);

  const rowProps: RowProps = {
    onToggleExpand: toggleExpand,
    onToggleDone: taskMutations.toggleDone,
    onPatch: taskMutations.patch,
    onSetStatus: taskMutations.setStatus,
    onReschedule: taskMutations.reschedule,
    onDelete: taskMutations.remove,
    projectOptions,
    questOptions,
  };

  // Wins ↔ daily.must_do (stored as [[slug]] wikilinks).
  const wins = useMemo(
    () => new Set((daily?.must_do ?? []).map((w) => wikiTarget(w))),
    [daily?.must_do],
  );
  const toggleWin = useCallback(
    (slug: string) => {
      if (!daily) return;
      const current = new Set(wins);
      if (current.has(slug)) current.delete(slug);
      else {
        if (current.size >= MAX_WINS) return;
        current.add(slug);
      }
      save({ must_do: [...current].map((s) => `[[${s}]]`) });
    },
    [daily, wins, save],
  );

  // Momentum — how much of today's actionable load is already done.
  const totalToday =
    bundle.overdue.length +
    bundle.today.length +
    bundle.evening.length +
    bundle.completedToday.length;
  const doneToday = bundle.completedToday.length;
  const pct = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;
  const allClear = totalToday > 0 && doneToday === totalToday;

  const started = status === "ready";
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Operating Rhythm" }, { label: "Morning Manifesto" }]} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {fromOnboarding && (
            <Link
              to="/welcome"
              className="mb-4 flex w-fit items-center gap-1.5 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-caption text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Back to setup
            </Link>
          )}

          {/* Hero */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-6 py-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
              <Sunrise className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-heading font-semibold">{greeting(now)}</h1>
              <p className="text-caption text-muted-foreground">{dateLabel}</p>
            </div>
            {started && totalToday > 0 && (
              <div className="flex min-w-44 flex-col gap-1.5">
                <div className="flex items-center justify-between text-caption text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {allClear && <CheckCircle2 className="size-3.5 text-success" />}
                    {allClear ? "All clear" : "Today's progress"}
                  </span>
                  <span className="tabular-nums">
                    {doneToday}/{totalToday}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-slow ease-out",
                      allClear ? "bg-success" : "bg-primary",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Check-in zone */}
          {status === "loading" ? (
            <Skeleton className="mt-6 h-72 w-full rounded-lg" />
          ) : status === "error" ? (
            <Alert variant="destructive" className="mt-6">
              <AlertTitle>Couldn't load today's note</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
                Retry
              </Button>
            </Alert>
          ) : started ? (
            <div className="mt-6">
              <CheckIn morning={daily?.morning} onChange={(patch) => save({ morning: patch })} />
            </div>
          ) : (
            <StartCard onStart={start} />
          )}

          {/* Today board */}
          <div className="mt-6">
            {tasksLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <TodayBoard
                bundle={bundle}
                rowProps={rowProps}
                expandedPath={expandedPath}
                wins={started ? wins : undefined}
                onToggleWin={started ? toggleWin : undefined}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StartCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <Sunrise className="size-6 text-muted-foreground" />
      <h2 className="mt-3 text-subheading font-medium">Start your morning</h2>
      <p className="mt-1 max-w-md text-body text-muted-foreground">
        Open today's check-in to capture your mood, mindset, and intention. Your day's board is
        below — start when you're ready.
      </p>
      <Button className="mt-4" onClick={onStart}>
        Start your morning
      </Button>
    </div>
  );
}
