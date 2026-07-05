/**
 * EveningShutdownPage (Ch11 / D35) — the end-of-day ritual on the same daily
 * note as the morning (the `evening` block). A guided shutdown: night check-in →
 * clear the Inbox → plan tomorrow → "day closed". Lazy-created/reopened via the
 * shared `useDaily`; silent autosave. Built from the shared check-in kit + the
 * canonical shells. Consumes `useInbox()` read-only (no Inbox-feature edits).
 */

import { useInbox } from "@/app/inbox/inbox-provider";
import { PageHeader } from "@/app/page-header";
import { useProjects } from "@/app/projects/use-projects";
import { useQuests } from "@/app/quests/use-quests";
import { EveningCheckIn } from "@/app/rituals/evening/evening-check-in";
import { InboxClear } from "@/app/rituals/evening/inbox-clear";
import { type FocusOption, PlanTomorrow } from "@/app/rituals/evening/plan-tomorrow";
import { useDaily } from "@/app/rituals/morning/use-daily";
import { useTasks } from "@/app/tasks/use-tasks";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { areaSlug } from "@/shared/lib/areas";
import { isProjectFinished } from "@/shared/lib/projects";
import { isQuestFinished } from "@/shared/lib/quests";
import type { SchedulePick } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { buildTodayBundle } from "@/shared/lib/today";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import { CheckCircle2, Moon } from "lucide-react";
import { useCallback, useMemo } from "react";

export function EveningShutdownPage() {
  const { daily, status, error, start, save, reload } = useDaily();
  const { tasks, loading: tasksLoading, toggleDone, setStatus, reschedule } = useTasks();
  const { quests } = useQuests();
  const { projects } = useProjects();
  const { count: inboxCount } = useInbox();

  const now = useMemo(() => new Date(), []);
  const bundle = useMemo(() => buildTodayBundle(tasks, quests, now), [tasks, quests, now]);
  const leftovers = useMemo(
    () => [...bundle.overdue, ...bundle.today, ...bundle.evening],
    [bundle],
  );

  // Candidate work for tomorrow's focus — open tasks + live projects + quests.
  const candidates = useMemo<FocusOption[]>(() => {
    const t = tasks
      .filter((x) => x.status === "open" || x.status === "waiting")
      .map((x) => ({
        key: `task:${x.slug}`,
        type: "task" as const,
        slug: x.slug,
        label: x.title ?? x.slug,
        area: areaSlug(x.area) ?? undefined,
      }));
    const p = projects
      .filter((x) => !isProjectFinished(x.status))
      .map((x) => ({
        key: `project:${x.slug}`,
        type: "project" as const,
        slug: x.slug,
        label: x.title ?? x.slug,
        area: areaSlug(x.area) ?? undefined,
      }));
    const q = quests
      .filter((x) => !isQuestFinished(x.status))
      .map((x) => ({
        key: `quest:${x.slug}`,
        type: "quest" as const,
        slug: x.slug,
        label: x.title ?? x.slug,
        area: areaSlug(x.area) ?? undefined,
      }));
    return [...t, ...p, ...q];
  }, [tasks, projects, quests]);

  const evening = daily?.evening;
  const focus = useMemo(
    () => new Set((evening?.tomorrow_focus ?? []).map((w) => wikiTarget(w))),
    [evening?.tomorrow_focus],
  );

  const onToggleFocus = useCallback(
    (opt: FocusOption) => {
      if (!daily) return;
      const next = new Set(focus);
      if (next.has(opt.slug)) {
        next.delete(opt.slug);
      } else {
        next.add(opt.slug);
        // Picking a task as tomorrow's focus also schedules it to tomorrow.
        if (opt.type === "task") {
          const task = tasks.find((t) => t.slug === opt.slug);
          if (task) reschedule(task, "tomorrow");
        }
      }
      save({ evening: { tomorrow_focus: [...next].map((s) => `[[${s}]]`) } });
    },
    [daily, focus, tasks, reschedule, save],
  );

  const onReschedule = useCallback(
    (task: Task, pick: SchedulePick) => reschedule(task, pick),
    [reschedule],
  );
  const onDrop = useCallback((task: Task) => setStatus(task, "dropped"), [setStatus]);
  const onComplete = useCallback((task: Task) => toggleDone(task), [toggleDone]);

  const started = status === "ready";
  const complete = started && leftovers.length === 0 && inboxCount === 0;
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Operating Rhythm" }, { label: "Evening Shutdown" }]} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {/* Hero */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-6 py-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
              <Moon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-heading font-semibold">Wind down</h1>
              <p className="text-caption text-muted-foreground">{dateLabel}</p>
            </div>
            {started && (
              <div className="flex items-center gap-4 text-caption text-muted-foreground">
                <span className="tabular-nums">{leftovers.length} left on today</span>
                <span className="tabular-nums">Inbox {inboxCount}</span>
              </div>
            )}
          </div>

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
          ) : !started ? (
            <StartCard onStart={start} />
          ) : (
            <div className="mt-6 space-y-6">
              {complete && (
                <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 px-6 py-4">
                  <CheckCircle2 className="size-5 text-success" />
                  <div>
                    <p className="text-subheading font-medium">Day closed</p>
                    <p className="text-caption text-muted-foreground">
                      Today's plate is clear and the Inbox is at zero. Rest well.
                    </p>
                  </div>
                </div>
              )}

              <EveningCheckIn
                evening={evening}
                morningIntention={daily?.morning?.intention}
                completedToday={bundle.completedToday}
                onChange={(patch) => save({ evening: patch })}
              />

              <InboxClear />

              {tasksLoading ? (
                <Skeleton className="h-48 w-full rounded-lg" />
              ) : (
                <PlanTomorrow
                  leftovers={leftovers}
                  onReschedule={onReschedule}
                  onDrop={onDrop}
                  onComplete={onComplete}
                  candidates={candidates}
                  focus={focus}
                  onToggleFocus={onToggleFocus}
                  firstMove={evening?.tomorrow_first_task ?? ""}
                  onFirstMoveChange={(v) =>
                    save({ evening: { tomorrow_first_task: v || undefined } })
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StartCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <Moon className="size-6 text-muted-foreground" />
      <h2 className="mt-3 text-subheading font-medium">Begin your shutdown</h2>
      <p className="mt-1 max-w-md text-body text-muted-foreground">
        Reflect on the day, clear your Inbox to zero, and line up tomorrow. Start when you're ready
        to close the day.
      </p>
      <Button className="mt-4" onClick={onStart}>
        Begin shutdown
      </Button>
    </div>
  );
}
