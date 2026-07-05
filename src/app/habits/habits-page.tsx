/**
 * HabitsPage — overview grid of habit cards.
 *
 * Each card shows: habit name, mini heatmap (last 12 weeks), current streak,
 * completion %, and a control to tick today done (number input for quantity
 * habits). Empty state when no habits exist. "New habit" button opens dialog.
 *
 * Uses the flagship block-page shell layout (DESIGN.md).
 */

import { Heatmap } from "@/app/habits/heatmap";
import { NewHabitDialog } from "@/app/habits/new-habit-dialog";
import { useHabits } from "@/app/habits/use-habits";
import { PageHeader } from "@/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { Habit } from "@/shared/lib/habits/habits";
import {
  buildHeatmapGrid,
  completionPercent,
  currentStreak,
  isCompletedOn,
  todayStr,
  toggleHabitCompletion,
} from "@/shared/lib/habits/habits";
import { Activity, Check, Flame } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function HabitsPage() {
  const { habits, loading, error, reload, create } = useHabits();

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Habits" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <h1 className="text-heading font-semibold">Habits</h1>
            <NewHabitDialog onCreate={create} />
          </div>

          {/* Content */}
          <div className="mt-6">
            {loading ? (
              <LoadingGrid />
            ) : error ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn't load habits</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
                  Retry
                </Button>
              </Alert>
            ) : habits.length === 0 ? (
              <EmptyState onCreate={create} />
            ) : (
              <HabitGrid habits={habits} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HabitGrid({ habits }: { habits: Habit[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {habits.map((habit) => (
        <HabitCard key={habit.path} habit={habit} />
      ))}
    </div>
  );
}

function HabitCard({ habit }: { habit: Habit }) {
  const navigate = useNavigate();
  const today = todayStr();
  const doneToday = isCompletedOn(habit, today);
  const streak = currentStreak(habit);
  const pct = completionPercent(habit, 30);
  const miniGrid = buildHeatmapGrid(habit, 12);
  const isQuantity = habit.habit_display === "bar";
  const [quantityDraft, setQuantityDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const handleTick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      if (isQuantity) {
        const val = Number.parseFloat(quantityDraft);
        const value = Number.isNaN(val) ? undefined : val;
        await toggleHabitCompletion(habit, today, value);
        setQuantityDraft("");
      } else {
        await toggleHabitCompletion(habit, today);
      }
      // Force a re-render by reloading: simpler than threading state up
      // (the detail page uses useHabit for reactive state; the card uses a
      // one-shot toggle that writes through and we refetch on next render
      // when the page remounts or we navigate back)
      window.location.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-hover"
      onClick={() => navigate(`/habits/${habit.slug}`)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-subheading font-medium">{habit.title || "Untitled"}</span>
          <div className="flex shrink-0 items-center gap-1 text-caption text-muted-foreground">
            {streak > 0 && (
              <>
                <span className="text-warning">{streak}</span>
                <Flame className="size-3.5 text-warning" />
              </>
            )}
          </div>
        </div>
        <p className="text-caption text-muted-foreground">{pct}% last 30 days</p>
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        {/* Mini heatmap — 12 weeks, compact squares */}
        <div className="overflow-x-auto">
          <Heatmap
            weeks={miniGrid}
            isQuantity={isQuantity}
            target={habit.habit_target}
            unit={habit.habit_unit}
            compact
          />
        </div>

        {/* Today tick — individual elements stop propagation so the card click doesn't fire */}
        <div className="mt-3 flex items-center gap-2">
          {isQuantity && !doneToday ? (
            <>
              <Input
                type="number"
                min={0}
                value={quantityDraft}
                onChange={(e) => setQuantityDraft(e.target.value)}
                placeholder={
                  habit.habit_target ? `/${habit.habit_target} ${habit.habit_unit ?? ""}` : "Amount"
                }
                className="h-8 w-32 text-caption"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={saving || !quantityDraft.trim()}
                onClick={handleTick}
                onKeyDown={(e) => e.stopPropagation()}
                className="h-8"
              >
                <Check className="size-3.5" />
                Log
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant={doneToday ? "default" : "outline"}
              disabled={saving}
              onClick={handleTick}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-8"
            >
              <Check className="size-3.5" />
              {doneToday ? "Done today" : "Mark done"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="mb-2 h-5 w-2/3" />
          <Skeleton className="mb-4 h-3.5 w-1/3" />
          <Skeleton className="h-[60px] w-full" />
          <Skeleton className="mt-3 h-8 w-28" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  onCreate,
}: { onCreate: (i: import("@/shared/lib/habits/habits").CreateHabitInput) => Promise<unknown> }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-16 text-center">
      <Activity className="size-5 text-muted-foreground" />
      <h2 className="mt-3 text-subheading font-medium">No habits yet</h2>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">
        A habit is a recurring task you track over time. Create your first habit to start the
        streak.
      </p>
      <div className="mt-4">
        <NewHabitDialog onCreate={onCreate} />
      </div>
    </div>
  );
}
