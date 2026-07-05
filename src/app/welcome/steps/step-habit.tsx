/**
 * Step 4c — One repeating task = a Habit (real creation, spec §3 Step 4c).
 * Embeds the real `NewHabitDialog`. Confirm copy gestures at the empty
 * heatmap without re-rendering it here — the real tracker lives on /habits.
 */

import { NewHabitDialog } from "@/app/habits/new-habit-dialog";
import { useHabits } from "@/app/habits/use-habits";
import { Button } from "@/shared/components/ui/button";
import type { Habit } from "@/shared/lib/habits/habits";
import { useState } from "react";

export function StepHabit({
  onNext,
}: {
  onNext: (habit: Habit | null) => void;
}) {
  const { create } = useHabits();
  const [created, setCreated] = useState<Habit | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">
          Something you do over and over? Make it a Habit.
        </h1>
        <p className="text-body text-muted-foreground">
          A repeating task is a Habit — the app tracks your streak instead of nagging you to
          re-create it. Add one you want to keep up, like a daily workout or ten minutes of reading.
        </p>
      </div>

      {created ? (
        <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-body">
          Here's your streak tracker — fill it in daily. Find it anytime on the Habits page.
        </p>
      ) : (
        <div>
          <NewHabitDialog
            onCreate={async (input) => {
              const habit = await create(input);
              setCreated(habit);
              return habit;
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={() => onNext(created)} disabled={!created}>
          Continue →
        </Button>
      </div>
    </div>
  );
}
