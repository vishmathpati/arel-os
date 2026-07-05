/**
 * useAreaDatabases — list the custom databases living in one area, and create
 * new ones (Ch8). Used by the Area page's Databases section. Area databases are
 * reached through their area (no global Databases nav — sealed sidebar groups).
 */

import {
  type CreateDatabaseInput,
  type DatabaseConfig,
  createDatabase,
  listDatabases,
} from "@/shared/lib/database-data";
import { useCallback, useEffect, useState } from "react";

export function useAreaDatabases(areaSlug: string) {
  const [databases, setDatabases] = useState<DatabaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDatabases(await listDatabases(areaSlug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load databases");
    } finally {
      setLoading(false);
    }
  }, [areaSlug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(async (input: CreateDatabaseInput) => {
    const cfg = await createDatabase(input);
    setDatabases((prev) => [...prev, cfg]);
    return cfg;
  }, []);

  return { databases, loading, error, reload, create };
}
