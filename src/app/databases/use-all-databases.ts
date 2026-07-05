/**
 * useAllDatabases — load every custom database (across all areas + standalone)
 * and create new ones (Ch8 global Databases surface). Backs the /databases
 * index page. Creation accepts an optional area, so standalone databases are
 * first-class.
 */

import {
  type CreateDatabaseInput,
  type DatabaseConfig,
  createDatabase,
  listDatabases,
} from "@/shared/lib/database-data";
import { useCallback, useEffect, useState } from "react";

export function useAllDatabases() {
  const [databases, setDatabases] = useState<DatabaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDatabases(await listDatabases());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load databases");
    } finally {
      setLoading(false);
    }
  }, []);

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
