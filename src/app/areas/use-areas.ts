/**
 * useAreas — the whole-vault area list, read fresh (mirrors usePages). Feeds
 * the sidebar AreasNav, every area picker (task/project/quest/habit/etc
 * dialogs), and the Areas index page. `create`/`rename`/`archive` mutate and
 * reload so every consumer sees the change immediately.
 */

import {
  type Area,
  type CreateAreaInput,
  createArea,
  listAreas,
  renameArea,
  setAreaArchived,
} from "@/shared/lib/area-data";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export interface UseAreas {
  /** Every area (top-level + sub-areas), sorted by order. */
  areas: Area[];
  /** Top-level areas only (no `parent`) — the identity/picker list. */
  topLevelAreas: Area[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Create a new top-level area. */
  create: (input: CreateAreaInput) => Promise<Area | null>;
  rename: (area: Area, name: string) => Promise<void>;
  archive: (area: Area, archived: boolean) => Promise<void>;
  /** Resolve a stored area wikilink/slug to its Area, or null if unknown. */
  byWikilink: (area: string | undefined) => Area | null;
  /** Human label for a stored area wikilink ("[[health]]" → "Health"). */
  labelOf: (area: string | undefined) => string | null;
  /** Identity color token ref for a stored area wikilink, or null if unknown. */
  colorOf: (area: string | undefined) => string | null;
  /** Identity icon for a stored area wikilink, or null if unknown. */
  iconOf: (area: string | undefined) => LucideIcon | null;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function useAreas(): UseAreas {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listAreas()
      .then(setAreas)
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const create = useCallback(
    async (input: CreateAreaInput) => {
      try {
        const area = await createArea(input);
        reload();
        return area;
      } catch (err) {
        toast.error(`Couldn't create area: ${errMessage(err)}`);
        return null;
      }
    },
    [reload],
  );

  const rename = useCallback(
    async (area: Area, name: string) => {
      const n = name.trim();
      if (!n || n === area.name) return;
      try {
        await renameArea(area, n);
        reload();
      } catch (err) {
        toast.error(`Couldn't rename area: ${errMessage(err)}`);
      }
    },
    [reload],
  );

  const archive = useCallback(
    async (area: Area, archived: boolean) => {
      try {
        await setAreaArchived(area, archived);
        toast.success(archived ? "Area archived" : "Area restored");
        reload();
      } catch (err) {
        toast.error(`Couldn't ${archived ? "archive" : "restore"} area: ${errMessage(err)}`);
      }
    },
    [reload],
  );

  const topLevelAreas = areas.filter((a) => !a.parent);

  const bySlug = useMemo(() => new Map(areas.map((a) => [a.slug, a])), [areas]);

  const byWikilink = useCallback(
    (area: string | undefined): Area | null => {
      if (!area) return null;
      return bySlug.get(wikiTarget(area)) ?? null;
    },
    [bySlug],
  );

  const labelOf = useCallback(
    (area: string | undefined): string | null => {
      if (!area) return null;
      return byWikilink(area)?.name ?? wikiTarget(area);
    },
    [byWikilink],
  );

  const colorOf = useCallback(
    (area: string | undefined) => byWikilink(area)?.color ?? null,
    [byWikilink],
  );

  const iconOf = useCallback(
    (area: string | undefined) => byWikilink(area)?.icon ?? null,
    [byWikilink],
  );

  return {
    areas,
    topLevelAreas,
    loading,
    error,
    reload,
    create,
    rename,
    archive,
    byWikilink,
    labelOf,
    colorOf,
    iconOf,
  };
}
