/**
 * useHabit — single-habit hook for the HabitDetailPage.
 * Mirrors the useQuest/useTask single-item hook pattern.
 */

import {
  type Habit,
  readHabit,
  toggleHabitCompletion,
  updateHabit,
} from "@/shared/lib/habits/habits";
import type { TaskFrontmatter } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useState } from "react";

interface UseHabitResult {
  habit: Habit | null;
  loading: boolean;
  notFound: boolean;
  error: string | null;
  reload: () => void;
  patch: (p: Partial<TaskFrontmatter>) => Promise<void>;
  toggleCompletion: (date: string, value?: number) => Promise<void>;
}

export function useHabit(slug: string): UseHabitResult {
  const [habit, setHabit] = useState<Habit | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: rev is an intentional reload counter
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    readHabit(slug)
      .then((h) => {
        if (!cancelled) {
          if (!h) setNotFound(true);
          else setHabit(h);
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
  }, [slug, rev]);

  const reload = useCallback(() => setRev((r) => r + 1), []);

  const patch = useCallback(
    async (p: Partial<TaskFrontmatter>) => {
      if (!habit) return;
      try {
        const updated = await updateHabit(habit, p);
        setHabit(updated);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [habit],
  );

  const toggleCompletion = useCallback(
    async (date: string, value?: number) => {
      if (!habit) return;
      try {
        const updated = await toggleHabitCompletion(habit, date, value);
        setHabit(updated);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [habit],
  );

  return { habit, loading, notFound, error, reload, patch, toggleCompletion };
}
