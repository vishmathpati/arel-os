/**
 * ProjectDashboard — the tabbed bottom block of a linked software project's page
 * (D64). Reads the saved snapshot and shows it across semantic tabs (NOT one per
 * file). The Notes tab is the project's existing Plate editor, passed in as
 * `notes`, so it lives as the final tab. shadcn Tabs (line variant) per DESIGN.md.
 */

import { formatRelTime } from "@/app/recipes/recipe-format";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { CircleAlert, FolderGit2, RefreshCw } from "lucide-react";
import {
  DecisionsTab,
  DesignFeelTab,
  FilesTab,
  OverviewTab,
  RoadmapTab,
  StructureTab,
} from "./dashboard-tabs";
import { StatePill } from "./dashboard-ui";
import { useSnapshot } from "./use-snapshot";

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "roadmap", label: "Roadmap" },
  { value: "decisions", label: "Decisions" },
  { value: "design", label: "Design/Feel" },
  { value: "structure", label: "Structure" },
  { value: "files", label: "Files" },
  { value: "notes", label: "Notes" },
] as const;

export function ProjectDashboard({
  slug,
  notes,
  onChangeFolder,
}: {
  slug: string;
  notes: React.ReactNode;
  onChangeFolder: () => void;
}) {
  const { snapshot, loading, error, reload } = useSnapshot(slug);
  const repoMissing = snapshot?.meta.repoPresent === false;

  return (
    <div className="flex flex-col gap-4">
      {/* Sync strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          {repoMissing ? (
            <span className="flex items-center gap-1.5 text-error">
              <CircleAlert className="size-3.5" />
              Folder not found — relink it
            </span>
          ) : snapshot ? (
            <>
              {snapshot.meta.state && <StatePill state={snapshot.meta.state} />}
              {snapshot.meta.syncedAt && (
                <span>Synced {formatRelTime(snapshot.meta.syncedAt)}</span>
              )}
            </>
          ) : (
            !loading && <span>Not synced yet</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onChangeFolder}>
            <FolderGit2 className="size-3.5" />
            Change folder
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList variant="line">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <Dash loading={loading} error={error} reload={reload}>
            <OverviewTab snapshot={snapshot} />
          </Dash>
        </TabsContent>
        <TabsContent value="roadmap" className="pt-4">
          <Dash loading={loading} error={error} reload={reload}>
            <RoadmapTab snapshot={snapshot} />
          </Dash>
        </TabsContent>
        <TabsContent value="decisions" className="pt-4">
          <Dash loading={loading} error={error} reload={reload}>
            <DecisionsTab snapshot={snapshot} />
          </Dash>
        </TabsContent>
        <TabsContent value="design" className="pt-4">
          <Dash loading={loading} error={error} reload={reload}>
            <DesignFeelTab snapshot={snapshot} />
          </Dash>
        </TabsContent>
        <TabsContent value="structure" className="pt-4">
          <Dash loading={loading} error={error} reload={reload}>
            <StructureTab snapshot={snapshot} />
          </Dash>
        </TabsContent>
        <TabsContent value="files" className="pt-4">
          <Dash loading={loading} error={error} reload={reload}>
            <FilesTab slug={slug} snapshot={snapshot} />
          </Dash>
        </TabsContent>
        <TabsContent value="notes" className="pt-4">
          {notes}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Loading/error wrapper shared by the snapshot-driven tabs (Notes is exempt). */
function Dash({
  loading,
  error,
  reload,
  children,
}: {
  loading: boolean;
  error: string | null;
  reload: () => void;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Couldn't load the dashboard</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
          Retry
        </Button>
      </Alert>
    );
  }
  return <>{children}</>;
}
