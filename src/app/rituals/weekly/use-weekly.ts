/**
 * useWeekly (Ch13 / D39) — loads the COMING week's note, lazily creates it on
 * first "Begin", and persists the review's own artifacts. Mirrors useDaily:
 * `save` is a debounced autosave for free-text (wins / learnings); `commit` is an
 * immediate write for discrete actions (focus snapshot, recurring, phase marks).
 * Local state is optimistic; vault writes are fire-and-forget.
 */

import type { WeeklyFrontmatter } from "@/shared/lib/vault/schemas";
import {
  type Weekly,
  applyWeeklyPatch,
  comingWeek,
  readWeekly,
  saveWeekly,
  startWeekly,
} from "@/shared/lib/weekly";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/** absent = the coming week's note not created yet (show the Begin CTA). */
export type WeeklyStatus = "loading" | "absent" | "ready" | "error";

export interface UseWeekly {
  weekly: Weekly | null;
  /** The ISO week being reviewed (YYYY-Www). */
  week: string;
  status: WeeklyStatus;
  error: string | null;
  /** Lazy-create the coming week's note (first click). No-op if it exists. */
  start: () => Promise<void>;
  /** Patch the note; debounced autosave (for free-text fields). */
  save: (patch: Partial<WeeklyFrontmatter>) => void;
  /** Patch the note; immediate write (for discrete actions). */
  commit: (patch: Partial<WeeklyFrontmatter>) => Promise<void>;
  reload: () => void;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

const SAVE_DEBOUNCE = 800;

export function useWeekly(): UseWeekly {
  const week = useMemo(() => comingWeek(), []);
  const [weekly, setWeekly] = useState<Weekly | null>(null);
  const [status, setStatus] = useState<WeeklyStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const latest = useRef<Weekly | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serialize writes: discrete commits fire close together (recurring toggle then
  // Finish), and out-of-order completion to the same file would clobber the last
  // patch. Chaining guarantees the freshest snapshot lands last.
  const chain = useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(() => {
    setStatus("loading");
    setError(null);
    readWeekly(week)
      .then((w) => {
        latest.current = w;
        setWeekly(w);
        setStatus(w ? "ready" : "absent");
      })
      .catch((err) => {
        setError(errMessage(err));
        setStatus("error");
      });
  }, [week]);

  useEffect(() => reload(), [reload]);

  // Persist the freshest snapshot, queued behind any in-flight write.
  const persist = useCallback(() => {
    const run = (): Promise<void> => {
      const cur = latest.current;
      if (!cur) return Promise.resolve();
      return saveWeekly(cur, {}).then(
        () => undefined,
        (err) => {
          toast.error(`Couldn't save: ${errMessage(err)}`);
        },
      );
    };
    chain.current = chain.current.then(run, run);
    return chain.current;
  }, []);

  // Persist any pending edit when the page unmounts.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        persist();
      }
    },
    [persist],
  );

  const start = useCallback(async () => {
    try {
      const w = await startWeekly(week);
      latest.current = w;
      setWeekly(w);
      setStatus("ready");
    } catch (err) {
      toast.error(`Couldn't start the review: ${errMessage(err)}`);
    }
  }, [week]);

  // Merge a patch into the ref synchronously (so back-to-back commits compound),
  // then mirror to render state.
  const apply = useCallback((patch: Partial<WeeklyFrontmatter>): Weekly | null => {
    const base = latest.current;
    if (!base) return null;
    const next = applyWeeklyPatch(base, patch);
    latest.current = next;
    setWeekly(next);
    return next;
  }, []);

  const save = useCallback(
    (patch: Partial<WeeklyFrontmatter>) => {
      apply(patch);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(persist, SAVE_DEBOUNCE);
    },
    [apply, persist],
  );

  const commit = useCallback(
    async (patch: Partial<WeeklyFrontmatter>) => {
      if (!apply(patch)) return;
      if (timer.current) clearTimeout(timer.current);
      await persist();
    },
    [apply, persist],
  );

  return { weekly, week, status, error, start, save, commit, reload };
}
