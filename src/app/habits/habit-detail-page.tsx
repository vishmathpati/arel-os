/**
 * HabitDetailPage — full-year heatmap (or bar chart for quantity habits),
 * streaks, completion %, click-to-backfill any day, settings panel.
 *
 * Follows the DetailShell + same header/breadcrumb pattern as the quest detail.
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { DetailShell, Field, InlineTitle } from "@/app/detail/detail-kit";
import { Heatmap } from "@/app/habits/heatmap";
import { useHabit } from "@/app/habits/use-habit";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { areaSlug } from "@/shared/lib/areas";
import {
  buildHeatmapGrid,
  completionPercent,
  currentStreak,
  isCompletedOn,
  longestStreak,
  todayStr,
  valueOn,
} from "@/shared/lib/habits/habits";
import { cn } from "@/shared/lib/utils";
import { BarChart2, Calendar } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

// ── Bar chart (quantity habits) ───────────────────────────────────────────────

function BarChart({
  habit,
  weeksBack = 16,
  onDayClick,
}: {
  habit: import("@/shared/lib/habits/habits").Habit;
  weeksBack?: number;
  onDayClick?: (date: string) => void;
}) {
  const grid = buildHeatmapGrid(habit, weeksBack);
  // Flatten to get the last N non-future days with values
  const days = grid
    .flat()
    .filter((d) => !d.future)
    .slice(-60);
  const maxVal = Math.max(
    ...(habit.habit_target ? [habit.habit_target] : [1]),
    ...days.map((d) => d.value ?? 0),
  );

  return (
    <div className="flex items-end gap-[2px] overflow-x-auto py-1">
      {days.map((day) => {
        const val = day.value ?? 0;
        const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const isToday = day.date === todayStr();
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onDayClick?.(day.date)}
            className="flex flex-col items-center gap-[2px] cursor-pointer"
            title={`${day.date}: ${val}${habit.habit_unit ? ` ${habit.habit_unit}` : ""}`}
            aria-label={`Log for ${day.date}`}
          >
            <div
              className={cn(
                "w-4 min-h-[2px] rounded-sm transition-all",
                day.completed ? "bg-success/80" : "bg-muted/40",
                isToday && "ring-1 ring-success",
              )}
              style={{
                height: `${Math.max(heightPct, day.completed ? 4 : 2)}px`,
                maxHeight: "80px",
              }}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-caption text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function HabitDetailPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { habit, loading, notFound, error, reload, patch, toggleCompletion } = useHabit(slug);
  const { topLevelAreas, labelOf } = useAreasContext();
  const [backfillDate, setBackfillDate] = useState("");
  const [backfillValue, setBackfillValue] = useState("");
  const [backfillSaving, setBackfillSaving] = useState(false);

  const fullGrid = useMemo(() => (habit ? buildHeatmapGrid(habit, 52) : []), [habit]);
  const today = todayStr();

  if (loading) {
    return (
      <DetailShell crumbs={[{ label: "Habits" }, { label: "Habit" }]}>
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-40" />
        <Skeleton className="mt-6 h-32 w-full rounded-lg" />
      </DetailShell>
    );
  }

  if (notFound || !habit) {
    return (
      <DetailShell crumbs={[{ label: "Habits" }, { label: "Habit" }]}>
        <Alert>
          <AlertTitle>Habit not found</AlertTitle>
          <AlertDescription>
            This habit doesn't exist or was archived.{" "}
            <button type="button" className="underline" onClick={() => navigate("/habits")}>
              Back to habits
            </button>
            .
          </AlertDescription>
        </Alert>
      </DetailShell>
    );
  }

  const streak = currentStreak(habit);
  const longest = longestStreak(habit);
  const pct30 = completionPercent(habit, 30);
  const isQuantity = habit.habit_display === "bar";
  const doneToday = isCompletedOn(habit, today);
  const habitAreaLabel = habit.area ? labelOf(habit.area) : null;
  const habitAreaSlug = habit.area ? areaSlug(habit.area) : null;
  const habitAreaColor = habitAreaSlug
    ? topLevelAreas.find((a) => a.slug === habitAreaSlug)?.color
    : null;

  const handleDayClick = async (date: string) => {
    if (isQuantity) {
      // For quantity habits, clicking a past day opens backfill
      setBackfillDate(date);
      const existing = valueOn(habit, date);
      setBackfillValue(existing !== undefined ? String(existing) : "");
    } else {
      await toggleCompletion(date);
    }
  };

  const handleBackfill = async () => {
    if (!backfillDate) return;
    setBackfillSaving(true);
    try {
      const val = Number.parseFloat(backfillValue);
      const value = Number.isNaN(val) ? undefined : val;
      await toggleCompletion(backfillDate, value);
      setBackfillDate("");
      setBackfillValue("");
    } finally {
      setBackfillSaving(false);
    }
  };

  const repeatLabel = (() => {
    if (habit.repeat === "daily") return "Daily";
    if (habit.repeat === "weekly") return "Weekly";
    if (habit.repeat === "every-n-days") return `Every ${habit.repeat_interval ?? 2} days`;
    return habit.repeat;
  })();

  return (
    <DetailShell crumbs={[{ label: "Habits" }, { label: habit.title || "Untitled" }]}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <InlineTitle value={habit.title ?? ""} onSave={(t) => patch({ title: t })} />
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
            {habitAreaLabel && (
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: habitAreaColor ?? "var(--color-muted-foreground)" }}
                />
                {habitAreaLabel}
              </span>
            )}
            <span>{repeatLabel}</span>
            {isQuantity && habit.habit_target && (
              <span>
                Target: {habit.habit_target}
                {habit.habit_unit ? ` ${habit.habit_unit}` : ""}
              </span>
            )}
          </div>
        </div>
        {/* Today action */}
        <div className="shrink-0">
          {isQuantity ? (
            <span className="text-caption text-muted-foreground">Click a day to log</span>
          ) : (
            <Button
              variant={doneToday ? "default" : "outline"}
              size="sm"
              onClick={() => handleDayClick(today)}
            >
              {doneToday ? "Done today" : "Mark done today"}
            </Button>
          )}
        </div>
      </div>

      {/* Stats band */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Current streak" value={`${streak}`} sub={streak === 1 ? "day" : "days"} />
        <StatCard
          label="Longest streak"
          value={`${longest}`}
          sub={longest === 1 ? "day" : "days"}
        />
        <StatCard label="Last 30 days" value={`${pct30}%`} sub="completion" />
        <StatCard
          label="Total completions"
          value={`${habit.completions?.length ?? 0}`}
          sub="all time"
        />
      </div>

      {/* Full-year visualization */}
      <section className="mt-8">
        <div className="flex items-center gap-2">
          {isQuantity ? (
            <BarChart2 className="size-4 text-muted-foreground" />
          ) : (
            <Calendar className="size-4 text-muted-foreground" />
          )}
          <h2 className="text-subheading font-medium">
            {isQuantity ? "Activity over time" : "Full year heatmap"}
          </h2>
        </div>
        <p className="mt-1 text-caption text-muted-foreground">
          {isQuantity
            ? "Click a day to log or edit a value."
            : "Click any day to toggle it. Use this to backfill past completions."}
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card p-4">
          {isQuantity ? (
            <BarChart habit={habit} weeksBack={16} onDayClick={handleDayClick} />
          ) : (
            <Heatmap weeks={fullGrid} isQuantity={false} onClick={handleDayClick} />
          )}
        </div>

        {/* Backfill panel for quantity habits */}
        {isQuantity && backfillDate && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <span className="text-body text-muted-foreground">{backfillDate}</span>
            <Input
              type="number"
              min={0}
              value={backfillValue}
              onChange={(e) => setBackfillValue(e.target.value)}
              placeholder={habit.habit_unit ? `Amount in ${habit.habit_unit}` : "Amount"}
              className="h-8 w-36 text-caption"
            />
            <Button size="sm" disabled={backfillSaving} onClick={handleBackfill} className="h-8">
              {isCompletedOn(habit, backfillDate) ? "Update" : "Log"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setBackfillDate("");
                setBackfillValue("");
              }}
              className="h-8"
            >
              Cancel
            </Button>
          </div>
        )}
      </section>

      {/* Settings */}
      <section className="mt-8">
        <h2 className="text-subheading font-medium">Settings</h2>
        <div className="mt-3 flex flex-col gap-3.5">
          <Field label="Display">
            <Select
              value={habit.habit_display ?? "heatmap"}
              onValueChange={(v) => patch({ habit_display: v as "heatmap" | "bar" })}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="heatmap">Binary (done / not done)</SelectItem>
                <SelectItem value="bar">Quantity (track a number)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Frequency">
            <Select
              value={habit.repeat}
              onValueChange={(v) => patch({ repeat: v as "daily" | "weekly" | "every-n-days" })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="every-n-days">Every N days</SelectItem>
              </SelectContent>
            </Select>
            {habit.repeat === "every-n-days" && (
              <Input
                type="number"
                min={2}
                defaultValue={habit.repeat_interval ?? 2}
                onBlur={(e) => {
                  const n = Number.parseInt(e.target.value, 10);
                  if (n >= 2 && n !== habit.repeat_interval) patch({ repeat_interval: n });
                }}
                className="h-8 w-20 text-caption"
              />
            )}
          </Field>

          <Field label="Target">
            <Input
              type="number"
              min={0}
              defaultValue={habit.habit_target ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                const n = v ? Number.parseFloat(v) : undefined;
                if (n !== habit.habit_target) patch({ habit_target: n });
              }}
              placeholder="e.g. 200"
              className="h-8 w-28 text-caption"
            />
            <Input
              defaultValue={habit.habit_unit ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim() || undefined;
                if (v !== habit.habit_unit) patch({ habit_unit: v });
              }}
              placeholder="unit (e.g. g)"
              className="h-8 w-24 text-caption"
            />
          </Field>

          <Field label="Area">
            <Select
              value={habitAreaSlug ?? ""}
              onValueChange={(v) => patch({ area: v ? `[[${v}]]` : undefined })}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="No area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No area</SelectItem>
                {topLevelAreas.map((a) => (
                  <SelectItem key={a.slug} value={a.slug}>
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                      {a.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
            Retry
          </Button>
        </Alert>
      )}
    </DetailShell>
  );
}
