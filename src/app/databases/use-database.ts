/**
 * useDatabase — load + mutate one custom database (Ch8): its `_index.md` config
 * plus its folder rows. Cell edits and row create/delete persist via the shared
 * row I/O; config edits (columns) write back to `_index.md`. Local state is
 * patched in place so the view stays stable mid-edit.
 */

import {
  type DatabaseConfig,
  createRow,
  listRows,
  readDatabase,
  updateDatabase,
} from "@/shared/lib/database-data";
import type { DbRow } from "@/shared/lib/db-rows";
import { deleteRow, setRowCell } from "@/shared/lib/db-rows";
import type { DatabaseColumn } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useState } from "react";

export function useDatabase(slug: string) {
  const [config, setConfig] = useState<DatabaseConfig | null>(null);
  const [rows, setRows] = useState<DbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await readDatabase(slug);
      if (!cfg) {
        setNotFound(true);
        return;
      }
      setConfig(cfg);
      setRows(await listRows(slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load database");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addRow = useCallback(
    async (title: string) => {
      const row = await createRow(slug, title);
      setRows((prev) => [...prev, row]);
      return row;
    },
    [slug],
  );

  const setCell = useCallback(async (row: DbRow, key: string, value: unknown) => {
    const next = await setRowCell(row, key, value);
    setRows((prev) => prev.map((r) => (r.path === row.path ? next : r)));
  }, []);

  const remove = useCallback(async (row: DbRow) => {
    await deleteRow(row);
    setRows((prev) => prev.filter((r) => r.path !== row.path));
  }, []);

  // Optimistic: update local config synchronously (no flicker on resize/reorder),
  // then persist in the background and reconcile with the server-stamped result.
  const setColumns = useCallback(
    async (columns: DatabaseColumn[]) => {
      if (!config) return;
      const base = config;
      setConfig({ ...base, columns });
      setConfig(await updateDatabase(base, { columns }));
    },
    [config],
  );

  const patchConfig = useCallback(
    async (patch: Parameters<typeof updateDatabase>[1]) => {
      if (!config) return;
      const base = config;
      setConfig({ ...base, ...patch });
      setConfig(await updateDatabase(base, patch));
    },
    [config],
  );

  return {
    config,
    rows,
    loading,
    notFound,
    error,
    reload,
    addRow,
    setCell,
    remove,
    setColumns,
    patchConfig,
  };
}
