/**
 * useDaily — loads today's daily note, lazily creates it on first "Start", and
 * autosaves morning answers with an 800ms debounce (silent, per DESIGN.md — no
 * "saved" toast). Local state is optimistic; the vault write is fire-and-forget
 * so fast typing never gets clobbered by a slower server echo.
 */

import {
  type Daily,
  applyDailyPatch,
  readDaily,
  saveDaily,
  startDaily,
  todayDate,
} from "@/shared/lib/daily";
import type { DailyFrontmatter } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/** absent = today's note not created yet (show the Start CTA). */
export type DailyStatus = "loading" | "absent" | "ready" | "error";

export interface UseDaily {
  daily: Daily | null;
  status: DailyStatus;
  error: string | null;
  /** Lazy-create today's note (first click). No-op if it already exists. */
  start: () => Promise<void>;
  /** Patch the note; debounced autosave. */
  save: (patch: Partial<DailyFrontmatter>) => void;
  reload: () => void;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

const SAVE_DEBOUNCE = 800;

export function useDaily(): UseDaily {
  const date = useMemo(() => todayDate(), []);
  const [daily, setDaily] = useState<Daily | null>(null);
  const [status, setStatus] = useState<DailyStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  // Latest note + a pending-flush timer, kept in refs so the debounced write
  // always persists the freshest state without re-creating the callback.
  const latest = useRef<Daily | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(() => {
    setStatus("loading");
    setError(null);
    readDaily(date)
      .then((d) => {
        latest.current = d;
        setDaily(d);
        setStatus(d ? "ready" : "absent");
      })
      .catch((err) => {
        setError(errMessage(err));
        setStatus("error");
      });
  }, [date]);

  useEffect(() => reload(), [reload]);

  const flush = useCallback(() => {
    const cur = latest.current;
    if (!cur) return;
    saveDaily(cur, {}).catch((err) => toast.error(`Couldn't save: ${errMessage(err)}`));
  }, []);

  // Persist any pending edit when the page unmounts.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    },
    [flush],
  );

  const start = useCallback(async () => {
    try {
      const d = await startDaily(date);
      latest.current = d;
      setDaily(d);
      setStatus("ready");
    } catch (err) {
      toast.error(`Couldn't start the manifesto: ${errMessage(err)}`);
    }
  }, [date]);

  const save = useCallback(
    (patch: Partial<DailyFrontmatter>) => {
      setDaily((prev) => {
        if (!prev) return prev;
        const next = applyDailyPatch(prev, patch);
        latest.current = next;
        return next;
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DEBOUNCE);
    },
    [flush],
  );

  return { daily, status, error, start, save, reload };
}
