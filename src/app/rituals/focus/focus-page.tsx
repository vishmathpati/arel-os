/**
 * FocusSessionPage (Ch12) — the execution ritual. A standalone Plan → Work →
 * Reflect timer against any task/project/quest/area; selecting a profile engages
 * Arel Focus website blocking during Work. Three screens — setup, active,
 * complete — driven by the localStorage-recoverable session engine. Each finished
 * session is logged to today's daily note.
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { PageHeader } from "@/app/page-header";
import { useProjects } from "@/app/projects/use-projects";
import { useQuests } from "@/app/quests/use-quests";
import { FocusActive } from "@/app/rituals/focus/focus-active";
import { FocusComplete } from "@/app/rituals/focus/focus-complete";
import { FocusSetup } from "@/app/rituals/focus/focus-setup";
import type { TargetOption } from "@/app/rituals/focus/target-picker";
import { useTasks } from "@/app/tasks/use-tasks";
import { areaSlug } from "@/shared/lib/areas";
import { useFocusSession } from "@/shared/lib/focus/use-focus-session";
import { isProjectFinished } from "@/shared/lib/projects";
import { isQuestFinished } from "@/shared/lib/quests";
import { Timer } from "lucide-react";
import { useMemo } from "react";

export function FocusSessionPage() {
  const focus = useFocusSession();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const { quests } = useQuests();
  const { topLevelAreas } = useAreasContext();

  const candidates = useMemo<TargetOption[]>(() => {
    const t: TargetOption[] = tasks
      .filter((x) => x.status === "open" || x.status === "waiting")
      .map((x) => ({
        key: `task:${x.slug}`,
        kind: "task",
        slug: x.slug,
        title: x.title ?? x.slug,
        area: areaSlug(x.area) ?? undefined,
      }));
    const p: TargetOption[] = projects
      .filter((x) => !isProjectFinished(x.status))
      .map((x) => ({
        key: `project:${x.slug}`,
        kind: "project",
        slug: x.slug,
        title: x.title ?? x.slug,
        area: areaSlug(x.area) ?? undefined,
      }));
    const q: TargetOption[] = quests
      .filter((x) => !isQuestFinished(x.status))
      .map((x) => ({
        key: `quest:${x.slug}`,
        kind: "quest",
        slug: x.slug,
        title: x.title ?? x.slug,
        area: areaSlug(x.area) ?? undefined,
      }));
    const a: TargetOption[] = topLevelAreas.map((x) => ({
      key: `area:${x.slug}`,
      kind: "area",
      slug: x.slug,
      title: x.name,
      area: x.slug,
    }));
    return [...t, ...p, ...q, ...a];
  }, [tasks, projects, quests, topLevelAreas]);

  const { session } = focus;
  const running = session && session.phase !== "done";

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Operating Rhythm" }, { label: "Focus Session" }]} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[840px] px-6 py-6">
          {/* Hero */}
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-6 py-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
              <Timer className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-heading font-semibold">Focus session</h1>
              <p className="text-caption text-muted-foreground">
                {running
                  ? "A session is in progress."
                  : session?.phase === "done"
                    ? "Session wrapped up."
                    : "Plan, work, reflect — one block at a time."}
              </p>
            </div>
          </div>

          {!session ? (
            <FocusSetup candidates={candidates} onStart={focus.start} />
          ) : session.phase === "done" ? (
            <FocusComplete session={session} result={focus.result} onNew={focus.reset} />
          ) : (
            <FocusActive
              session={session}
              remaining={focus.remaining}
              connection={focus.connection}
              blocked={focus.blocked}
              onStartWork={focus.startWork}
              onEndWork={focus.endWork}
              onFinish={focus.finishReflect}
              onCancel={focus.cancel}
              onRescue={focus.rescue}
              onToggleAllow={focus.toggleAllow}
              onReflectionChange={focus.setReflection}
            />
          )}
        </div>
      </div>
    </div>
  );
}
