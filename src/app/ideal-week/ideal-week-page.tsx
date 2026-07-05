/**
 * IdealWeekPage (Ch14 / D40) — the repeating weekly template. A Mon–Sun time grid
 * (06:00–23:00) of recurring blocks; click an empty slot to add, click a block to
 * edit. One file (`system/ideal-week.md`) via useIdealWeek. v1 = recurring blocks
 * only; one-off/per-week + Google Calendar push are deferred (BRIEF D40).
 */

import { BlockDialog, type BlockDraft, type LinkOption } from "@/app/ideal-week/block-dialog";
import { IdealWeekGrid } from "@/app/ideal-week/ideal-week-grid";
import { useIdealWeek } from "@/app/ideal-week/use-ideal-week";
import { PageHeader } from "@/app/page-header";
import { useProjects } from "@/app/projects/use-projects";
import { useQuests } from "@/app/quests/use-quests";
import { useTasks } from "@/app/tasks/use-tasks";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type CreateBlockInput,
  categoryAccent,
  formatTimeLabel,
  timeOptions,
} from "@/shared/lib/ideal-week";
import { isProjectFinished } from "@/shared/lib/projects";
import { isQuestFinished } from "@/shared/lib/quests";
import type { IdealWeekBlock, WeekDay } from "@/shared/lib/vault/schemas";
import { CalendarRange, Plus } from "lucide-react";
import { useMemo, useState } from "react";

export function IdealWeekPage() {
  const { blocks, dayStart, dayEnd, loading, error, reload, add, update, remove, setGridWindow } =
    useIdealWeek();
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const { quests } = useQuests();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IdealWeekBlock | null>(null);
  const [draft, setDraft] = useState<BlockDraft | null>(null);

  const linkOptions = useMemo<LinkOption[]>(() => {
    const t = tasks
      .filter((x) => x.status === "open" || x.status === "waiting")
      .map((x) => ({
        key: `task:${x.slug}`,
        type: "task" as const,
        slug: x.slug,
        label: x.title ?? x.slug,
      }));
    const p = projects
      .filter((x) => !isProjectFinished(x.status))
      .map((x) => ({
        key: `project:${x.slug}`,
        type: "project" as const,
        slug: x.slug,
        label: x.title ?? x.slug,
      }));
    const q = quests
      .filter((x) => !isQuestFinished(x.status))
      .map((x) => ({
        key: `quest:${x.slug}`,
        type: "quest" as const,
        slug: x.slug,
        label: x.title ?? x.slug,
      }));
    return [...t, ...p, ...q];
  }, [tasks, projects, quests]);

  const onAddAt = (day: WeekDay, start: string, end: string) => {
    setEditing(null);
    setDraft({ day, start, end });
    setOpen(true);
  };
  // Keyboard entry point — opens the dialog prefilled to the window start so the
  // day/time Selects do the placing (preserves a11y now the grid surface is a div).
  const onAddViaButton = () => {
    const end = timeOptions(dayStart, dayEnd).find((o) => o.value > dayStart)?.value ?? dayEnd;
    setEditing(null);
    setDraft({ day: "monday", start: dayStart, end });
    setOpen(true);
  };
  const onResizeBlock = (id: string, start: string, end: string) => {
    update(id, { start, end });
  };
  const onEditBlock = (block: IdealWeekBlock) => {
    setDraft(null);
    setEditing(block);
    setOpen(true);
  };
  const onSubmit = (input: CreateBlockInput) => {
    if (editing) {
      // CreateBlockInput.area is a plain string; the block's area is an AreaSlug.
      update(editing.id, {
        day: input.day,
        start: input.start,
        end: input.end,
        label: input.label,
        category: input.category,
        area: input.area as IdealWeekBlock["area"],
        link: input.link,
      });
    } else {
      add(input);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Operating Rhythm" }, { label: "Ideal Week" }]} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          {/* Hero */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-6 py-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
              <CalendarRange className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-heading font-semibold">Ideal week</h1>
              <p className="text-caption text-muted-foreground">
                Your repeating weekly template — the shape you want every week to take.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-caption text-muted-foreground">Day</span>
                <WindowControl
                  ariaLabel="Day starts"
                  value={dayStart}
                  options={WINDOW_TIMES.filter((o) => o.value < dayEnd)}
                  onChange={(v) => setGridWindow(v, dayEnd)}
                />
                <span className="text-caption text-muted-foreground">to</span>
                <WindowControl
                  ariaLabel="Day ends"
                  value={dayEnd}
                  options={WINDOW_TIMES.filter((o) => o.value > dayStart)}
                  onChange={(v) => setGridWindow(dayStart, v)}
                />
              </div>
              <Button size="sm" onClick={onAddViaButton}>
                <Plus className="size-4" />
                Add block
              </Button>
            </div>
          </div>

          {/* Category legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
            {CATEGORY_ORDER.map((c) => (
              <span
                key={c}
                className="flex items-center gap-1.5 text-caption text-muted-foreground"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: categoryAccent(c) }}
                />
                {CATEGORY_LABEL[c]}
              </span>
            ))}
          </div>

          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-[40rem] w-full rounded-lg" />
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn't load your ideal week</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
                  Retry
                </Button>
              </Alert>
            ) : (
              <IdealWeekGrid
                blocks={blocks}
                dayStart={dayStart}
                dayEnd={dayEnd}
                onAddAt={onAddAt}
                onEditBlock={onEditBlock}
                onResizeBlock={onResizeBlock}
              />
            )}
          </div>
        </div>
      </div>

      <BlockDialog
        open={open}
        onOpenChange={setOpen}
        block={editing}
        draft={draft}
        linkOptions={linkOptions}
        dayStart={dayStart}
        dayEnd={dayEnd}
        onSubmit={onSubmit}
        onDelete={remove}
      />
    </div>
  );
}

// Window-control choices: full day at 30-min granularity (the grid window is a
// coarse template setting; blocks themselves still snap to 15 min).
const WINDOW_TIMES = timeOptions("00:00", "24:00", 30).map((o) => ({
  value: o.value,
  // 24:00 reads as "End of day"; everything else as a 12-hour label.
  label: o.value === "24:00" ? "12:00 AM" : formatTimeLabel(o.value),
}));

/** A small themed time Select for the grid-window header control. */
function WindowControl({
  ariaLabel,
  value,
  options,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={ariaLabel} className="w-28 tabular-nums">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <ScrollArea className="h-60">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="tabular-nums">
              {o.label}
            </SelectItem>
          ))}
        </ScrollArea>
      </SelectContent>
    </Select>
  );
}
