/**
 * useArea — loads one area's `_index.md` (seeding the 6 top-level areas on first
 * touch) plus its sub-areas, and exposes the inline description save. Mirrors the
 * useTasks pattern: confirmed writes update local state, failures surface as a
 * manual-dismiss error toast.
 */

import {
  type Area,
  type CreateSubAreaInput,
  createSubArea,
  ensureAreasSeeded,
  listSubAreas,
  readArea,
  setAreaBody,
  setAreaDescription,
} from "@/shared/lib/area-data";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UseArea {
  area: Area | null;
  subAreas: Area[];
  loading: boolean;
  /** Set when the slug doesn't resolve to a known area. */
  notFound: boolean;
  error: string | null;
  reload: () => void;
  saveDescription: (description: string) => Promise<void>;
  saveBody: (body: string) => Promise<void>;
  /** Create a sub-area under the current area; reloads sub-areas on success. */
  addSubArea: (input: CreateSubAreaInput) => Promise<Area | null>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useArea(slug: string): UseArea {
  const [area, setArea] = useState<Area | null>(null);
  const [subAreas, setSubAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    (async () => {
      await ensureAreasSeeded();
      const [a, subs] = await Promise.all([readArea(slug), listSubAreas(slug)]);
      if (!a) {
        setNotFound(true);
        setArea(null);
        setSubAreas([]);
        return;
      }
      setArea(a);
      setSubAreas(subs);
    })()
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => reload(), [reload]);

  const saveDescription = useCallback(
    async (description: string) => {
      if (!area || description === area.description) return;
      try {
        setArea(await setAreaDescription(area, description));
      } catch (err) {
        toast.error(`Couldn't save description: ${errMessage(err)}`);
      }
    },
    [area],
  );

  const saveBody = useCallback(
    async (body: string) => {
      if (!area || body === area.body) return;
      try {
        setArea(await setAreaBody(area, body));
      } catch (err) {
        toast.error(`Couldn't save: ${errMessage(err)}`);
      }
    },
    [area],
  );

  const addSubArea = useCallback(
    async (input: CreateSubAreaInput): Promise<Area | null> => {
      if (!area) return null;
      try {
        const sub = await createSubArea(area.slug, input);
        setSubAreas((prev) => [...prev, sub].sort((a, b) => a.order - b.order));
        return sub;
      } catch (err) {
        toast.error(`Couldn't create sub-area: ${errMessage(err)}`);
        return null;
      }
    },
    [area],
  );

  return {
    area,
    subAreas,
    loading,
    notFound,
    error,
    reload,
    saveDescription,
    saveBody,
    addSubArea,
  };
}
