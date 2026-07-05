/**
 * QuestsPage — the global quest list on the flagship block-page shell (D22):
 * status stat band → toolbar (lens pills + Group-by) → one contained table
 * (Quest · Status · Area · Deadline · Focus). Flat by default; grouping opt-in.
 * Rows navigate to the detail page. Creation is the New-quest dialog.
 */

import { PageHeader } from "@/app/page-header";
import { NewQuestDialog } from "@/app/quests/new-quest-dialog";
import { QUEST_GRID, QuestRow } from "@/app/quests/quest-row";
import { useQuests } from "@/app/quests/use-quests";
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
import type { Quest } from "@/shared/lib/quest-data";
import { QUEST_STATUS_META, QUEST_STATUS_ORDER } from "@/shared/lib/quests";
import { cn } from "@/shared/lib/utils";
import type { QuestStatus } from "@/shared/lib/vault/schemas";
import { Activity, CircleCheck, Compass, type LucideIcon, Pause, Target } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

type Lens = "active" | "planned" | "paused" | "done" | "all";
type GroupBy = "none" | "area" | "status";

const LENSES: ReadonlyArray<{ key: Lens; label: string }> = [
  { key: "active", label: "Active" },
  { key: "planned", label: "Planned" },
  { key: "paused", label: "Paused" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];

const LENS_STATUSES: Record<Exclude<Lens, "all">, readonly QuestStatus[]> = {
  active: ["active"],
  planned: ["planned"],
  paused: ["paused"],
  done: ["done", "dropped"],
};

interface StatDef {
  key: Lens;
  label: string;
  icon: LucideIcon;
  statuses: readonly QuestStatus[];
}
const STATS: readonly StatDef[] = [
  { key: "active", label: "Active", icon: Activity, statuses: ["active"] },
  { key: "planned", label: "Planned", icon: Target, statuses: ["planned"] },
  { key: "paused", label: "Paused", icon: Pause, statuses: ["paused"] },
  { key: "done", label: "Done", icon: CircleCheck, statuses: ["done", "dropped"] },
];

function byDeadline(a: Quest, b: Quest): number {
  return (a.deadline ?? "").localeCompare(b.deadline ?? "");
}

interface Section {
  key: string;
  label: string;
  dotClass?: string;
  dotColor?: string;
  labelClass?: string;
  quests: Quest[];
}

function filterByLens(quests: Quest[], lens: Lens): Quest[] {
  if (lens === "all") return quests;
  const allowed = LENS_STATUSES[lens];
  return quests.filter((q) => allowed.includes(q.status));
}

function statusSections(quests: Quest[]): Section[] {
  return QUEST_STATUS_ORDER.map((s) => ({
    key: s,
    label: QUEST_STATUS_META[s].label,
    dotClass: QUEST_STATUS_META[s].dotClass,
    labelClass: QUEST_STATUS_META[s].labelClass,
    quests: quests.filter((q) => q.status === s).sort(byDeadline),
  })).filter((sec) => sec.quests.length > 0);
}

function areaSections(quests: Quest[]): Section[] {
  const sections: Section[] = [];
  for (const a of AREA_OPTIONS) {
    const inArea = quests.filter((q) => areaSlug(q.area) === a.slug).sort(byDeadline);
    if (inArea.length) {
      sections.push({ key: a.slug, label: a.label, dotColor: a.color, quests: inArea });
    }
  }
  return sections;
}

export function QuestsPage() {
  const { quests, loading, error, reload, create } = useQuests();
  const [lens, setLens] = useState<Lens>("active");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const s of STATS) c[s.key] = quests.filter((q) => s.statuses.includes(q.status)).length;
    return c;
  }, [quests]);

  const filtered = useMemo(() => filterByLens(quests, lens), [quests, lens]);
  const flat = useMemo(
    () => (groupBy === "none" ? [...filtered].sort(byDeadline) : null),
    [filtered, groupBy],
  );
  const sections = useMemo(() => {
    if (groupBy === "area") return areaSections(filtered);
    if (groupBy === "status") return statusSections(filtered);
    return [];
  }, [filtered, groupBy]);

  const isEmpty = groupBy === "none" ? (flat?.length ?? 0) === 0 : sections.length === 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Quests" }]} />
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
                </SelectContent>
              </Select>
              <NewQuestDialog onCreate={create} />
            </div>
          </div>

          {/* Table */}
          <div className="mt-4">
            {loading ? (
              <LoadingTable />
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn't load quests</AlertTitle>
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
                {groupBy === "none"
                  ? flat?.map((q) => <QuestRow key={q.path} quest={q} />)
                  : sections.map((section) => (
                      <Fragment key={section.key}>
                        <div className="flex h-9 items-center gap-2 border-b border-border/60 bg-muted/20 px-4">
                          {section.dotColor ? (
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
                            {section.quests.length}
                          </span>
                        </div>
                        {section.quests.map((q) => (
                          <QuestRow key={q.path} quest={q} />
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
        <div key={r} className={cn(QUEST_GRID, "h-11 border-b border-border/60")}>
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-12" />
          <Skeleton className="h-3.5 w-4" />
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
  onCreate: (input: import("@/shared/lib/quest-data").CreateQuestInput) => Promise<unknown>;
}) {
  const heading = lens === "all" ? "No quests yet" : `No ${lens} quests`;
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-16 text-center">
      <Compass className="size-5 text-muted-foreground" />
      <h2 className="mt-3 text-subheading font-medium">{heading}</h2>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">
        A quest is a goal with a deadline that gathers projects. Use New quest to add one.
      </p>
      <div className="mt-4">
        <NewQuestDialog onCreate={onCreate} />
      </div>
    </div>
  );
}
