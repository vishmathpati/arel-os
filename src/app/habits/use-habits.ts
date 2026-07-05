/**
 * useHabits — list + create hook for the HabitsPage overview.
 * Mirrors the useQuests/useTasks pattern exactly.
 */

import {
  type CreateHabitInput,
  type Habit,
  createHabit,
  listHabits,
} from "@/shared/lib/habits/habits";
import { useCallback, useEffect, useState } from "react";

interface UseHabitsResult {
  habits: Habit[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  create: (input: CreateHabitInput) => Promise<Habit>;
}

export function useHabits(): UseHabitsResult {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rev is an intentional reload counter
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listHabits()
      .then((h) => {
        if (!cancelled) {
          setHabits(h);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rev]);

  const reload = useCallback(() => setRev((r) => r + 1), []);

  const create = useCallback(async (input: CreateHabitInput): Promise<Habit> => {
    const habit = await createHabit(input);
    setHabits((prev) => [...prev, habit]);
    return habit;
  }, []);

  return { habits, loading, error, reload, create };
}
