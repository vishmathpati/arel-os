/**
 * useSnapshot — loads a software project's saved dashboard snapshot
 * (system/project-snapshots/<slug>.md). Returns null when the project has never
 * been synced (the dashboard then shows its empty state). The UI never reads code
 * and never runs the AI — it only reads this snapshot (D64).
 */

import { readSnapshot } from "@/shared/lib/project-dashboard/client";
import type { ProjectSnapshot } from "@/shared/lib/project-dashboard/snapshot";
import { useCallback, useEffect, useState } from "react";

export interface UseSnapshot {
  snapshot: ProjectSnapshot | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useSnapshot(slug: string): UseSnapshot {
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    readSnapshot(slug)
      .then(setSnapshot)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the dashboard"))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => reload(), [reload]);

  return { snapshot, loading, error, reload };
}
