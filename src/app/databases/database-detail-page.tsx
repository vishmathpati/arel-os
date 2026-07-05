/**
 * DatabaseDetailPage — a custom database's home (Ch8). Header (name + area +
 * description + Properties panel) over the reusable DatabaseView (Table / Board).
 * Rows are the folder's files; each opens as a Page at /databases/:slug/:row.
 * New rows are added inline from the Table. Add properties via the "+" header button + Properties panel.
 */

import { DatabaseView } from "@/app/databases/database-view";
import { useDatabase } from "@/app/databases/use-database";
import { DetailShell, InlineTitle } from "@/app/detail/detail-kit";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { areaColor, areaLabel } from "@/shared/lib/areas";
import type { DbRow } from "@/shared/lib/db-rows";
import { Database } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

export function DatabaseDetailPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const db = useDatabase(slug);

  // No skeleton — local reads are instant; a skeleton only flickers on refresh.
  if (db.loading) {
    return (
      <DetailShell crumbs={[{ label: "Databases" }, { label: "Database" }]}>{null}</DetailShell>
    );
  }

  if (db.notFound || !db.config) {
    return (
      <DetailShell crumbs={[{ label: "Databases" }, { label: "Database" }]}>
        <Alert>
          <AlertTitle>Database not found</AlertTitle>
          <AlertDescription>
            This database doesn’t exist or was archived.{" "}
            <button type="button" className="underline" onClick={() => navigate("/")}>
              Go home
            </button>
            .
          </AlertDescription>
        </Alert>
      </DetailShell>
    );
  }

  const { config, rows } = db;
  const columns = config.columns ?? [];
  const area = config.area ? areaLabel(config.area) : null;
  const color = config.area ? areaColor(config.area) : null;
  const openRow = (row: DbRow) => navigate(`/databases/${slug}/${row.slug}`);

  return (
    <DetailShell
      crumbs={[{ label: "Databases" }, { label: config.name || "Database" }]}
      fullWidth={config.full_width}
    >
      {/* Header */}
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <Database className="size-5 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <InlineTitle value={config.name ?? ""} onSave={(name) => db.patchConfig({ name })} />
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
            {area && (
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: color ?? "var(--color-muted-foreground)" }}
                />
                {area}
              </span>
            )}
            {config.description && <span>{config.description}</span>}
            <span className="tabular-nums">
              {rows.length} {rows.length === 1 ? "row" : "rows"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <DatabaseView
          columns={columns}
          rows={rows}
          error={db.error}
          onRetry={db.reload}
          onCellChange={db.setCell}
          onOpenRow={openRow}
          onDeleteRow={db.remove}
          onAddRow={(title) => db.addRow(title)}
          onColumnsChange={db.setColumns}
          fullWidth={config.full_width}
          onFullWidthChange={(v) => db.patchConfig({ full_width: v })}
          emptyLabel="No rows yet. Add one below."
        />
      </div>
    </DetailShell>
  );
}
