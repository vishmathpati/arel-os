/**
 * ResourcesSection — an embedded filtered Library view (Ch8). Drop it on an
 * Area / Project / Quest page with a filter; it shows that entity's resources
 * (the same Library data, no duplication) and pre-links new resources to the
 * entity so they show up immediately. Reuses the shared DatabaseView.
 */

import { DatabaseView } from "@/app/databases/database-view";
import { NewResourceDialog } from "@/app/databases/new-resource-dialog";
import { useResources } from "@/app/databases/use-resources";
import type { DbRow } from "@/shared/lib/db-rows";
import { LIBRARY_COLUMNS } from "@/shared/lib/resource-data";
import { useNavigate } from "react-router-dom";

export function ResourcesSection({
  filter,
}: {
  filter: { area?: string; project?: string; quest?: string };
}) {
  const { rows, loading, error, reload, create, setCell, remove } = useResources(filter);
  const navigate = useNavigate();

  const openRow = (row: DbRow) => navigate(`/library/${row.slug}`);
  const onCreate = (input: Parameters<typeof create>[0]) =>
    create({
      ...input,
      area: input.area ?? filter.area,
      project: filter.project,
      quest: filter.quest,
    });

  return (
    <DatabaseView
      columns={LIBRARY_COLUMNS}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={reload}
      onCellChange={setCell}
      onOpenRow={openRow}
      onDeleteRow={remove}
      emptyLabel="No resources here yet. Add one to link it."
      toolbarExtra={<NewResourceDialog defaultArea={filter.area} onCreate={onCreate} />}
    />
  );
}
