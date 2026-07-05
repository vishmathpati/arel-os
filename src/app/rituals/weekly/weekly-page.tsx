/**
 * WeeklyReviewPage (Ch13 / D39) — the Sunday ritual over the COMING week's note.
 * A linear three-phase stepper (Reflect → Maintain → Plan) with free back-nav and
 * a terminal "Week is planned" state. Reflect/Plan write the weekly note; Maintain
 * acts on the vault directly. Per-day assignments are tasks' own schedule dates;
 * recurring assignments pre-seed next week. Lazy-created via useWeekly.
 */

import { useInbox } from "@/app/inbox/inbox-provider";
import { PageHeader } from "@/app/page-header";
import { useProjects } from "@/app/projects/use-projects";
import { useQuests } from "@/app/quests/use-quests";
import { MaintainPhase } from "@/app/rituals/weekly/maintain-phase";
import { PlanPhase } from "@/app/rituals/weekly/plan-phase";
import { ReflectPhase } from "@/app/rituals/weekly/reflect-phase";
import { useWeekly } from "@/app/rituals/weekly/use-weekly";
import { useTasks } from "@/app/tasks/use-tasks";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { isProjectFinished } from "@/shared/lib/projects";
import { isQuestFinished } from "@/shared/lib/quests";
import { scheduleBucket } from "@/shared/lib/tasks/schedule";
import type { Task } from "@/shared/lib/tasks/tasks";
import { cn } from "@/shared/lib/utils";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { WeekDay } from "@/shared/lib/vault/schemas";
import {
  isWeekPlanned,
  previousWeek,
  readWeekly,
  weekDayDates,
  weekRangeLabel,
} from "@/shared/lib/weekly";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  Compass,
  Sparkles,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

type PhaseKey = "reflect" | "maintain" | "plan";

const PHASES: ReadonlyArray<{ key: PhaseKey; label: string }> = [
  { key: "reflect", label: "Reflect" },
  { key: "maintain", label: "Maintain" },
  { key: "plan", label: "Plan" },
];

const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function WeeklyReviewPage() {
  const { weekly, week, status, error, start, save, commit, reload } = useWeekly();
  const quests = useQuests();
  const projects = useProjects();
  const tasksApi = useTasks();
  const { count: inboxCount } = useInbox();
  const { tasks, reschedule, setStatus: setTaskStatus, toggleDone } = tasksApi;

  const [phase, setPhase] = useState(0);

  const weekDates = useMemo(() => weekDayDates(week), [week]);
  const today = todayStr();

  // ── Derived data ───────────────────────────────────────────────────────────
  const focusQuests = useMemo(
    () => quests.quests.filter((q) => q.focus && !isQuestFinished(q.status)),
    [quests.quests],
  );
  const activeQuests = useMemo(
    () => quests.quests.filter((q) => !isQuestFinished(q.status)),
    [quests.quests],
  );
  const overdueQuests = useMemo(
    () =>
      quests.quests.filter((q) => !isQuestFinished(q.status) && q.deadline.slice(0, 10) < today),
    [quests.quests, today],
  );
  const focusSlugs = useMemo(() => new Set(focusQuests.map((q) => q.slug)), [focusQuests]);

  const rehoming = useMemo(
    () => projects.projects.filter((p) => p.demoted && !isProjectFinished(p.status)),
    [projects.projects],
  );

  const actionable = useCallback((t: Task) => t.status === "open" || t.status === "waiting", []);
  const staleTasks = useMemo(
    () => tasks.filter((t) => actionable(t) && scheduleBucket(t.schedule) === "overdue"),
    [tasks, actionable],
  );
  const assignableTasks = useMemo(() => tasks.filter(actionable), [tasks, actionable]);

  const assignmentsByDay = useMemo(() => {
    const byDay = {} as Record<WeekDay, Task[]>;
    for (const day of Object.keys(weekDates) as WeekDay[]) byDay[day] = [];
    for (const t of tasks) {
      if (!actionable(t)) continue;
      const d = t.schedule.slice(0, 10);
      for (const day of Object.keys(weekDates) as WeekDay[]) {
        if (weekDates[day] === d) byDay[day].push(t);
      }
    }
    return byDay;
  }, [tasks, weekDates, actionable]);

  const recurringKeys = useMemo(
    () => new Set((weekly?.recurring ?? []).map((r) => `${r.day}:${wikiTarget(r.task)}`)),
    [weekly?.recurring],
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const onToggleFocus = useCallback(
    (quest: { slug: string; focus?: boolean }) => {
      const q = quests.quests.find((x) => x.slug === quest.slug);
      if (!q) return;
      const next = !q.focus;
      quests.patch(q, { focus: next || undefined });
      const slugs = new Set(focusSlugs);
      if (next) slugs.add(q.slug);
      else slugs.delete(q.slug);
      commit({ focus_quests: [...slugs].map((s) => `[[${s}]]`) });
    },
    [quests, focusSlugs, commit],
  );

  const onAttachQuest = useCallback(
    (project: { path: string }, questSlug: string) => {
      const p = projects.projects.find((x) => x.path === project.path);
      if (p) projects.patch(p, { quest: `[[${questSlug}]]`, demoted: undefined });
    },
    [projects],
  );
  const onKeepStandalone = useCallback(
    (project: { path: string }) => {
      const p = projects.projects.find((x) => x.path === project.path);
      if (p) projects.patch(p, { demoted: undefined });
    },
    [projects],
  );

  const endQuest = useCallback(
    async (quest: Parameters<typeof quests.setStatus>[0], status: "done" | "dropped") => {
      const demoted = await quests.setStatus(quest, status);
      if (demoted > 0) projects.reload();
    },
    [quests, projects],
  );

  const onToggleRecurring = useCallback(
    (day: WeekDay, task: Task) => {
      const key = `${day}:${task.slug}`;
      const current = weekly?.recurring ?? [];
      const exists = current.some((r) => `${r.day}:${wikiTarget(r.task)}` === key);
      const next = exists
        ? current.filter((r) => `${r.day}:${wikiTarget(r.task)}` !== key)
        : [...current, { day, task: `[[${task.slug}]]` }];
      commit({ recurring: next });
    },
    [weekly?.recurring, commit],
  );

  // Lazy-create + pre-seed last week's recurring assignments into this week.
  const handleStart = useCallback(async () => {
    await start();
    const prev = await readWeekly(previousWeek(week));
    if (!prev?.recurring?.length) return;
    for (const r of prev.recurring) {
      const slug = wikiTarget(r.task);
      const task = tasks.find((t) => t.slug === slug);
      if (task) await reschedule(task, { date: weekDates[r.day] });
    }
  }, [start, week, tasks, reschedule, weekDates]);

  // ── Stepper ────────────────────────────────────────────────────────────────
  const progress = weekly?.progress;
  const planned = isWeekPlanned(weekly);
  const advance = useCallback(() => {
    const key = PHASES[phase].key;
    commit({ progress: { [key]: true } });
    if (phase < PHASES.length - 1) setPhase(phase + 1);
  }, [phase, commit]);

  const started = status === "ready";

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Operating Rhythm" }, { label: "Weekly Review" }]} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {/* Hero */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-6 py-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
              <CalendarCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-heading font-semibold">Weekly review</h1>
              <p className="text-caption text-muted-foreground">
                {week} · {weekRangeLabel(week)}
              </p>
            </div>
          </div>

          {status === "loading" ? (
            <Skeleton className="mt-6 h-96 w-full rounded-lg" />
          ) : status === "error" ? (
            <Alert variant="destructive" className="mt-6">
              <AlertTitle>Couldn't load the weekly note</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
                Retry
              </Button>
            </Alert>
          ) : !started ? (
            <StartCard onStart={handleStart} range={weekRangeLabel(week)} />
          ) : (
            <div className="mt-6 space-y-6">
              {planned && (
                <div className="flex items-center gap-3 rounded-lg border border-success/40 bg-success/5 px-6 py-4">
                  <CheckCircle2 className="size-5 text-success" />
                  <div>
                    <p className="text-subheading font-medium">Week is planned</p>
                    <p className="text-caption text-muted-foreground">
                      Reflected, maintained, and planned. The week ahead is set.
                    </p>
                  </div>
                </div>
              )}

              <Stepper phase={phase} progress={progress} onJump={setPhase} />

              <div className="min-h-[20rem]">
                {phase === 0 && (
                  <ReflectPhase
                    focusQuests={focusQuests}
                    wins={weekly?.wins ?? []}
                    learnings={weekly?.learnings ?? []}
                    onToggleMilestone={(q, i) => quests.toggleMilestoneAt(q, i)}
                    onChange={(p) => save(p)}
                  />
                )}
                {phase === 1 && (
                  <MaintainPhase
                    rehoming={rehoming}
                    activeQuests={activeQuests}
                    overdueQuests={overdueQuests}
                    staleTasks={staleTasks}
                    inboxCount={inboxCount}
                    onAttachQuest={onAttachQuest}
                    onKeepStandalone={onKeepStandalone}
                    onQuestDone={(q) => endQuest(q, "done")}
                    onQuestRoll={(q, d) => quests.roll(q, d)}
                    onQuestDrop={(q) => endQuest(q, "dropped")}
                    onRescheduleTask={(t, pick) => reschedule(t, pick)}
                    onDropTask={(t) => setTaskStatus(t, "dropped")}
                    onCompleteTask={(t) => toggleDone(t)}
                  />
                )}
                {phase === 2 && (
                  <PlanPhase
                    focusableQuests={activeQuests}
                    focusSlugs={focusSlugs}
                    onToggleFocus={onToggleFocus}
                    weekDates={weekDates}
                    assignmentsByDay={assignmentsByDay}
                    assignableTasks={assignableTasks}
                    recurringKeys={recurringKeys}
                    onAssign={(t, day) => reschedule(t, { date: weekDates[day] })}
                    onUnassign={(t) => reschedule(t, "unscheduled")}
                    onToggleRecurring={onToggleRecurring}
                  />
                )}
              </div>

              {/* Footer nav */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setPhase(phase - 1)}
                  disabled={phase === 0}
                  className="gap-1.5"
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                {phase < PHASES.length - 1 ? (
                  <Button onClick={advance} className="gap-1.5">
                    Continue
                    <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button onClick={advance} disabled={planned} className="gap-1.5">
                    <Check className="size-4" />
                    {planned ? "Review complete" : "Finish review"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({
  phase,
  progress,
  onJump,
}: {
  phase: number;
  progress: { reflect?: boolean; maintain?: boolean; plan?: boolean } | undefined;
  onJump: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {PHASES.map((p, i) => {
        const done = !!progress?.[p.key];
        const active = i === phase;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onJump(i)}
            className={cn(
              "flex flex-1 items-center gap-2.5 rounded-lg border px-4 py-3 text-left transition-colors",
              active ? "border-foreground/25 bg-accent" : "border-border bg-card/40 hover:bg-hover",
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-medium tabular-nums",
                done
                  ? "bg-success/15 text-success"
                  : active
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-body font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {p.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StartCard({ onStart, range }: { onStart: () => void; range: string }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-14 text-center">
      <span className="flex gap-2 text-muted-foreground">
        <Sparkles className="size-6" />
        <Compass className="size-6" />
      </span>
      <h2 className="mt-3 text-subheading font-medium">Begin your weekly review</h2>
      <p className="mt-1 max-w-md text-body text-muted-foreground">
        Reflect on the week behind, tidy what's drifted, and plan the week of {range}. Takes about
        an hour, once a week.
      </p>
      <Button className="mt-4" onClick={onStart}>
        Begin review
      </Button>
    </div>
  );
}
