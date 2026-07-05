/**
 * useResources — load + mutate Library resources (Ch8). The Library is a filter
 * (`type: resource`) over `pages/`; pass a project/quest slug to scope it to
 * that entity's resources (the embedded filtered views). Cell edits persist via
 * the shared row I/O and patch local state in place (no full reload, so Table /
 * Board stay stable mid-edit).
 */

import type { DbRow } from "@/shared/lib/db-rows";
import { deleteRow, setRowCell } from "@/shared/lib/db-rows";
import {
  type CreateResourceInput,
  createResource,
  listResources,
} from "@/shared/lib/resource-data";
import { useCallback, useEffect, useState } from "react";

export function useResources(filter?: { area?: string; project?: string; quest?: string }) {
  const [rows, setRows] = useState<DbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const area = filter?.area;
  const project = filter?.project;
  const quest = filter?.quest;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listResources({ area, project, quest }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load resources");
    } finally {
      setLoading(false);
    }
  }, [area, project, quest]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(async (input: CreateResourceInput) => {
    const row = await createResource(input);
    setRows((prev) => [...prev, row]);
    return row;
  }, []);

  const setCell = useCallback(async (row: DbRow, key: string, value: unknown) => {
    const next = await setRowCell(row, key, value);
    setRows((prev) => prev.map((r) => (r.path === row.path ? next : r)));
  }, []);

  const remove = useCallback(async (row: DbRow) => {
    await deleteRow(row);
    setRows((prev) => prev.filter((r) => r.path !== row.path));
  }, []);

  return { rows, loading, error, reload, create, setCell, remove };
}
