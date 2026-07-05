/**
 * AreaDatabasesSection — the custom databases living in an area (Ch8). Lists
 * each as a clickable card to its detail page, with a New-database action.
 * Creating one jumps straight to it so columns can be added.
 */

import { NewDatabaseDialog } from "@/app/databases/new-database-dialog";
import { useAreaDatabases } from "@/app/databases/use-area-databases";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Database } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AreaDatabasesSection({ areaSlug }: { areaSlug: string }) {
  const { databases, loading, create } = useAreaDatabases(areaSlug);
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <NewDatabaseDialog
          defaultArea={areaSlug}
          onCreate={async (input) => {
            const cfg = await create(input);
            navigate(`/databases/${cfg.slug}`);
            return cfg;
          }}
        />
      </div>
      {loading ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : databases.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-10 text-center">
          <Database className="size-5 text-muted-foreground" />
          <p className="mt-2 text-body text-muted-foreground">
            No databases in this area yet. Create one to track records.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {databases.map((db) => (
            <button
              key={db.slug}
              type="button"
              onClick={() => navigate(`/databases/${db.slug}`)}
              className="flex w-full items-center gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-hover"
            >
              <Database className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium">{db.name}</span>
                {db.description && (
                  <span className="block truncate text-caption text-muted-foreground">
                    {db.description}
                  </span>
                )}
              </span>
              <span className="text-caption tabular-nums text-muted-foreground">
                {(db.columns ?? []).length} cols
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
