/**
 * useIdealWeek (Ch14 / D40) — loads the Ideal Week template (read-or-create) and
 * exposes block CRUD. Mutations confirm-then-replace from the write; a ref keeps
 * the freshest doc so back-to-back edits build on each other. Modal-driven, so
 * writes are effectively serial.
 */

import {
  type CreateBlockInput,
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
  type IdealWeek,
  addBlock,
  readIdealWeek,
  removeBlock,
  setWindow,
  updateBlock,
} from "@/shared/lib/ideal-week";
import type { IdealWeekBlock } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface UseIdealWeek {
  blocks: IdealWeekBlock[];
  /** Grid window start, "HH:MM" (default 08:00). */
  dayStart: string;
  /** Grid window end, "HH:MM" (default 23:00). */
  dayEnd: string;
  loading: boolean;
  error: string | null;
  reload: () => void;
  add: (input: CreateBlockInput) => Promise<void>;
  update: (id: string, patch: Partial<IdealWeekBlock>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setGridWindow: (dayStart: string, dayEnd: string) => Promise<void>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useIdealWeek(): UseIdealWeek {
  const [iw, setIw] = useState<IdealWeek | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<IdealWeek | null>(null);

  const apply = useCallback((next: IdealWeek) => {
    latest.current = next;
    setIw(next);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    readIdealWeek()
      .then(apply)
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, [apply]);

  useEffect(() => reload(), [reload]);

  const add = useCallback(
    async (input: CreateBlockInput) => {
      if (!latest.current) return;
      try {
        apply(await addBlock(latest.current, input));
      } catch (err) {
        toast.error(`Couldn't add block: ${errMessage(err)}`);
      }
    },
    [apply],
  );

  const update = useCallback(
    async (id: string, patch: Partial<IdealWeekBlock>) => {
      if (!latest.current) return;
      try {
        apply(await updateBlock(latest.current, id, patch));
      } catch (err) {
        toast.error(`Couldn't save block: ${errMessage(err)}`);
      }
    },
    [apply],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!latest.current) return;
      try {
        apply(await removeBlock(latest.current, id));
      } catch (err) {
        toast.error(`Couldn't delete block: ${errMessage(err)}`);
      }
    },
    [apply],
  );

  const setGridWindow = useCallback(
    async (dayStart: string, dayEnd: string) => {
      if (!latest.current) return;
      try {
        apply(await setWindow(latest.current, dayStart, dayEnd));
      } catch (err) {
        toast.error(`Couldn't update the window: ${errMessage(err)}`);
      }
    },
    [apply],
  );

  return {
    blocks: iw?.blocks ?? [],
    dayStart: iw?.day_start ?? DEFAULT_DAY_START,
    dayEnd: iw?.day_end ?? DEFAULT_DAY_END,
    loading,
    error,
    reload,
    add,
    update,
    remove,
    setGridWindow,
  };
}
