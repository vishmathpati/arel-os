/**
 * DatabasesIndexPage (/databases) — the global Databases surface (Ch8). Lists
 * every custom database grouped by area, with a "Standalone" group for area-less
 * ones, plus the Library (the fixed-schema master Resources Database). Each card
 * opens its detail page. "New database" creates one with no area required.
 */

import { NewDatabaseDialog } from "@/app/databases/new-database-dialog";
import { useAllDatabases } from "@/app/databases/use-all-databases";
import { PageHeader } from "@/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AREA_OPTIONS, areaSlug } from "@/shared/lib/areas";
import type { DatabaseConfig } from "@/shared/lib/database-data";
import { Database, Library as LibraryIcon } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

interface Group {
  key: string;
  label: string;
  color?: string;
  databases: DatabaseConfig[];
}

function groupByArea(databases: DatabaseConfig[]): Group[] {
  const groups: Group[] = [];
  for (const a of AREA_OPTIONS) {
    const inArea = databases.filter((d) => areaSlug(d.area) === a.slug);
    if (inArea.length)
      groups.push({ key: a.slug, label: a.label, color: a.color, databases: inArea });
  }
  const standalone = databases.filter((d) => !d.area || !areaSlug(d.area));
  if (standalone.length)
    groups.push({ key: "standalone", label: "Standalone", databases: standalone });
  return groups;
}

export function DatabasesIndexPage() {
  const { databases, loading, error, reload, create } = useAllDatabases();
  const navigate = useNavigate();
  const groups = useMemo(() => groupByArea(databases), [databases]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Databases" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption text-muted-foreground">
              Structured records you maintain. The Library is your master resources database.
            </p>
            <NewDatabaseDialog
              onCreate={async (input) => {
                const cfg = await create(input);
                navigate(`/databases/${cfg.slug}`);
                return cfg;
              }}
            />
          </div>

          {/* Library — the fixed-schema resource DB */}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => navigate("/library")}
              className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-hover"
            >
              <LibraryIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-medium">Library</span>
                <span className="block truncate text-caption text-muted-foreground">
                  Master collection of resources — links, videos, notes.
                </span>
              </span>
            </button>
          </div>

          {loading ? (
            <Skeleton className="mt-6 h-24 w-full rounded-lg" />
          ) : error ? (
            <Alert variant="destructive" className="mt-6">
              <AlertTitle>Couldn't load databases</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
                Retry
              </Button>
            </Alert>
          ) : groups.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-16 text-center">
              <Database className="size-5 text-muted-foreground" />
              <h2 className="mt-3 text-subheading font-medium">No databases yet</h2>
              <p className="mt-1 max-w-sm text-body text-muted-foreground">
                A database is a structured set of records — subscriptions, a food log, anything you
                track. Create one to get started.
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="mt-6">
                <div className="mb-2 flex items-center gap-2">
                  {g.color ? (
                    <span className="size-2 rounded-full" style={{ backgroundColor: g.color }} />
                  ) : (
                    <span className="size-2 rounded-full bg-muted-foreground/40" />
                  )}
                  <h2 className="text-caption font-medium text-muted-foreground">{g.label}</h2>
                  <span className="text-caption tabular-nums text-muted-foreground">
                    {g.databases.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.databases.map((db) => (
                    <button
                      key={db.slug}
                      type="button"
                      onClick={() => navigate(`/databases/${db.slug}`)}
                      className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-hover"
                    >
                      <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium">{db.name}</span>
                        {db.description && (
                          <span className="mt-0.5 block truncate text-caption text-muted-foreground">
                            {db.description}
                          </span>
                        )}
                        <span className="mt-1 block text-caption text-muted-foreground">
                          {(db.columns ?? []).length} columns
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
