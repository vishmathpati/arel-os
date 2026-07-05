/**
 * useRecipes — loads the Engine recipe list + model config, and exposes the
 * control-center mutations (set default/fallback model, per-recipe model override,
 * per-recipe enable, on-demand run). Mirrors the useArea/useTasks pattern:
 * confirmed writes update local state; failures surface as a manual-dismiss error
 * toast. Loading/error/reload are exposed so the page renders every state.
 */

import {
  type EngineConfig,
  type RecipeListItem,
  type RunOutcome,
  type RunRecord,
  type SchedulerEntry,
  listRecipes,
  listRuns,
  readEngineConfig,
  readScheduleState,
  runRecipe,
  writeEngineConfig,
} from "@/shared/lib/engine/client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UseRecipes {
  recipes: RecipeListItem[];
  config: EngineConfig | null;
  /** Scheduler state (next_due + last_fired per recipe). */
  scheduleState: Record<string, SchedulerEntry>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Set the global default model (POST /engine/config). */
  setDefaultModel: (model: string) => Promise<void>;
  /** Set the global fallback model (POST /engine/config). */
  setFallbackModel: (model: string) => Promise<void>;
  /** Override one recipe's model ("" clears it → use global default). */
  setRecipeModel: (name: string, model: string) => Promise<void>;
  /** Override one recipe's fallback model ("" clears it → use global fallback). */
  setRecipeFallback: (name: string, fallback: string) => Promise<void>;
  /** Set one recipe's schedule override ("" clears it → use SKILL.md schedule). */
  setRecipeSchedule: (name: string, schedule: string) => Promise<void>;
  /** Toggle one recipe's enabled flag (POST /engine/config recipes[name].enabled). */
  setRecipeEnabled: (name: string, enabled: boolean) => Promise<void>;
  /** Names of recipes whose run is in flight. */
  running: ReadonlySet<string>;
  /** Run a recipe on demand (POST /engine/run); refreshes the list on completion. */
  run: (name: string) => Promise<void>;
  /** Fetch run history for one recipe on demand (lazy). */
  fetchRuns: (name: string, limit?: number) => Promise<RunRecord[]>;
}

export type { RunRecord };

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useRecipes(): UseRecipes {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [config, setConfig] = useState<EngineConfig | null>(null);
  const [scheduleState, setScheduleState] = useState<Record<string, SchedulerEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    (async () => {
      const [{ recipes: list }, cfg, sched] = await Promise.all([
        listRecipes(),
        readEngineConfig(),
        readScheduleState(),
      ]);
      setRecipes(list);
      setConfig(cfg);
      setScheduleState(sched);
    })()
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const setDefaultModel = useCallback(
    async (model: string) => {
      if (!config || model === config.defaultModel) return;
      try {
        setConfig(await writeEngineConfig({ defaultModel: model }));
      } catch (err) {
        toast.error(`Couldn't set default model: ${errMessage(err)}`);
      }
    },
    [config],
  );

  const setFallbackModel = useCallback(
    async (model: string) => {
      if (!config || model === config.fallbackModel) return;
      try {
        setConfig(await writeEngineConfig({ fallbackModel: model }));
      } catch (err) {
        toast.error(`Couldn't set fallback model: ${errMessage(err)}`);
      }
    },
    [config],
  );

  const setRecipeModel = useCallback(async (name: string, model: string) => {
    try {
      const next = await writeEngineConfig({ recipes: { [name]: { model } } });
      setConfig(next);
      // "" clears the override → modelOverride becomes undefined (use global default).
      setRecipes((prev) =>
        prev.map((r) => (r.name === name ? { ...r, modelOverride: model || undefined } : r)),
      );
    } catch (err) {
      toast.error(`Couldn't set model for ${name}: ${errMessage(err)}`);
    }
  }, []);

  const setRecipeFallback = useCallback(async (name: string, fallback: string) => {
    try {
      setConfig(await writeEngineConfig({ recipes: { [name]: { fallback } } }));
      setRecipes((prev) =>
        prev.map((r) => (r.name === name ? { ...r, fallbackOverride: fallback || undefined } : r)),
      );
    } catch (err) {
      toast.error(`Couldn't set fallback for ${name}: ${errMessage(err)}`);
    }
  }, []);

  const setRecipeSchedule = useCallback(
    async (name: string, schedule: string) => {
      try {
        await writeEngineConfig({ recipes: { [name]: { schedule } } });
        // Re-fetch: effective schedule (override ?? SKILL.md) + recomputed next_due.
        reload();
      } catch (err) {
        toast.error(`Couldn't set schedule for ${name}: ${errMessage(err)}`);
      }
    },
    [reload],
  );

  const setRecipeEnabled = useCallback(async (name: string, enabled: boolean) => {
    // Optimistic — the switch should feel immediate.
    setRecipes((prev) => prev.map((r) => (r.name === name ? { ...r, enabled } : r)));
    try {
      setConfig(await writeEngineConfig({ recipes: { [name]: { enabled } } }));
    } catch (err) {
      setRecipes((prev) => prev.map((r) => (r.name === name ? { ...r, enabled: !enabled } : r)));
      toast.error(`Couldn't ${enabled ? "enable" : "disable"} ${name}: ${errMessage(err)}`);
    }
  }, []);

  const run = useCallback(async (name: string) => {
    setRunning((prev) => new Set(prev).add(name));
    try {
      const outcome: RunOutcome = await runRecipe(name);
      if (outcome.status === "ok") {
        toast.success(`${name} finished: ${outcome.summary}`);
      } else {
        toast.error(`${name} failed: ${outcome.summary}`);
      }
      // Reflect the fresh last-run on the row without a full reload.
      setRecipes((prev) =>
        prev.map((r) =>
          r.name === name
            ? {
                ...r,
                lastRun: {
                  status: outcome.status,
                  at: new Date().toISOString(),
                  summary: outcome.summary,
                },
              }
            : r,
        ),
      );
    } catch (err) {
      toast.error(`Couldn't run ${name}: ${errMessage(err)}`);
    } finally {
      setRunning((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    }
  }, []);

  const fetchRuns = useCallback(async (name: string, limit = 50): Promise<RunRecord[]> => {
    const { runs } = await listRuns(name, limit);
    return runs;
  }, []);

  return {
    recipes,
    config,
    scheduleState,
    loading,
    error,
    reload,
    setDefaultModel,
    setFallbackModel,
    setRecipeModel,
    setRecipeFallback,
    setRecipeSchedule,
    setRecipeEnabled,
    running,
    run,
    fetchRuns,
  };
}
