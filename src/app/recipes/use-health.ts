/**
 * Health polling hooks. The whole point of the quality-control dashboard is that
 * it KEEPS checking — so these hooks re-probe on an interval, not once. A recipe's
 * dependencies (Gmail, model, currency, vault) are re-checked every `intervalMs`
 * while the page is open, and a manual `recheck()` bypasses the server cache.
 */

import { type RecipeHealth, getAllHealth, getRecipeHealth } from "@/shared/lib/engine/client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface UseRecipeHealth {
  health: RecipeHealth | null;
  loading: boolean;
  error: string | null;
  /** Force a fresh probe (bypasses the server's short cache). */
  recheck: () => void;
  /** Whether a manual re-check is currently running. */
  rechecking: boolean;
}

/** Poll one recipe's dependency health on an interval (default 20s). */
export function useRecipeHealth(name: string, intervalMs = 20_000): UseRecipeHealth {
  const [health, setHealth] = useState<RecipeHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const alive = useRef(true);

  const load = useCallback(
    async (fresh: boolean) => {
      try {
        const h = await getRecipeHealth(name, fresh);
        if (alive.current) {
          setHealth(h);
          setError(null);
        }
      } catch (err) {
        if (alive.current) setError(err instanceof Error ? err.message : "Health check failed");
      }
    },
    [name],
  );

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    load(false).finally(() => {
      if (alive.current) setLoading(false);
    });
    const id = setInterval(() => load(false), intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [load, intervalMs]);

  const recheck = useCallback(() => {
    setRechecking(true);
    load(true).finally(() => {
      if (alive.current) setRechecking(false);
    });
  }, [load]);

  return { health, loading, error, recheck, rechecking };
}

/** Poll every recipe's health (for the index table's status column). */
export function useAllHealth(intervalMs = 45_000): Record<string, RecipeHealth> {
  const [all, setAll] = useState<Record<string, RecipeHealth>>({});
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const load = () => {
      getAllHealth()
        .then((h) => {
          if (alive.current) setAll(h);
        })
        .catch(() => {
          /* a failed health poll shouldn't break the page; leave the last-known state */
        });
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return all;
}
