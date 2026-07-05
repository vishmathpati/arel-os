/**
 * LibraryPage — the master Resources Database (Ch8 · rich views D33). The
 * Library is a filter (`type: resource`) over `pages/`. Composition: stat band →
 * a view switcher. "All" renders the reusable DatabaseView (Table / Board);
 * "Tweets" renders a Twitter-style feed and "Videos" a YouTube-style grid of the
 * same resources, so a clipped tweet/video browses as the card you triaged.
 */

import { ArticleCard } from "@/app/captures/article-card";
import { TweetCard } from "@/app/captures/tweet-card";
import { VideoCard } from "@/app/captures/video-card";
import { DatabaseView } from "@/app/databases/database-view";
import { NewResourceDialog } from "@/app/databases/new-resource-dialog";
import { useResources } from "@/app/databases/use-resources";
import { PageHeader } from "@/app/page-header";
import { Button } from "@/shared/components/ui/button";
import {
  type TweetGroup,
  captureFromRow,
  isTweetCapture,
  isVideoCapture,
  tweetGroup,
} from "@/shared/lib/capture-view";
import type { DbRow } from "@/shared/lib/db-rows";
import { LIBRARY_COLUMNS } from "@/shared/lib/resource-data";
import { cn } from "@/shared/lib/utils";
import { ArrowUpRight, CircleDot, Inbox, Library as LibraryIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type View = "all" | "tweet" | "video" | "article";

const VIEWS: ReadonlyArray<{ key: View; label: string }> = [
  { key: "all", label: "All" },
  { key: "tweet", label: "Tweets" },
  { key: "video", label: "Videos" },
  { key: "article", label: "Articles" },
];

const TWEET_GROUPS: ReadonlyArray<{ key: TweetGroup; label: string }> = [
  { key: "tweets", label: "Tweets" },
  { key: "replies", label: "Replies" },
  { key: "threads", label: "Threads" },
];

export function LibraryPage() {
  const { rows, loading, error, reload, create, setCell, remove } = useResources();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("all");

  const counts = useMemo(() => {
    const unsorted = rows.filter((r) => (r.frontmatter.status ?? "unsorted") === "unsorted").length;
    return { total: rows.length, unsorted, filed: rows.length - unsorted };
  }, [rows]);

  const openRow = (row: DbRow) => navigate(`/library/${row.slug}`);

  const kindRows = useMemo(() => {
    if (view === "all") return rows;
    return rows.filter((r) => {
      const v = captureFromRow(r);
      if (view === "tweet") return isTweetCapture(v);
      if (view === "video") return isVideoCapture(v);
      return v.resource_kind === "article";
    });
  }, [rows, view]);

  const OpenButton = ({ row }: { row: DbRow }) => (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => openRow(row)}
      >
        Open
        <ArrowUpRight className="size-3.5" />
      </Button>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Library" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {/* Stat band */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              icon={<LibraryIcon className="size-4" />}
              label="Resources"
              value={counts.total}
            />
            <Stat icon={<Inbox className="size-4" />} label="Unsorted" value={counts.unsorted} />
            <Stat icon={<CircleDot className="size-4" />} label="Filed" value={counts.filed} />
          </div>

          {/* View switcher */}
          <div className="mt-6 flex items-center gap-1">
            {VIEWS.map(({ key, label }) => (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                className={cn(
                  "text-muted-foreground",
                  view === key && "bg-accent text-accent-foreground",
                )}
                onClick={() => setView(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="mt-3">
            {view === "all" ? (
              <DatabaseView
                columns={LIBRARY_COLUMNS}
                rows={rows}
                loading={loading}
                error={error}
                onRetry={reload}
                onCellChange={setCell}
                onOpenRow={openRow}
                onDeleteRow={remove}
                emptyLabel="No resources yet. Add one to start your Library."
                toolbarExtra={<NewResourceDialog onCreate={create} />}
              />
            ) : kindRows.length === 0 ? (
              <EmptyKind view={view} />
            ) : view === "tweet" ? (
              <div className="mx-auto max-w-xl space-y-6">
                {TWEET_GROUPS.map(({ key, label }) => {
                  const group = kindRows.filter((r) => tweetGroup(captureFromRow(r)) === key);
                  if (group.length === 0) return null;
                  return (
                    <div key={key}>
                      <div className="mb-2 flex items-center gap-2 text-caption text-muted-foreground">
                        <span className="font-medium">{label}</span>
                        <span className="tabular-nums">{group.length}</span>
                      </div>
                      <div className="flex flex-col gap-3">
                        {group.map((row) => (
                          <TweetCard
                            key={row.path}
                            view={captureFromRow(row)}
                            actions={<OpenButton row={row} />}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : view === "article" ? (
              <div className="mx-auto flex max-w-xl flex-col gap-3">
                {kindRows.map((row) => (
                  <ArticleCard
                    key={row.path}
                    view={captureFromRow(row)}
                    onOpen={() => openRow(row)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kindRows.map((row) => (
                  <VideoCard
                    key={row.path}
                    view={captureFromRow(row)}
                    actions={<OpenButton row={row} />}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyKind({ view }: { view: "tweet" | "video" | "article" }) {
  const noun = view === "tweet" ? "tweet" : view === "video" ? "video" : "article";
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-16 text-center">
      <h2 className="text-subheading font-medium">No {noun}s in your Library yet</h2>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">
        Clip {noun === "article" ? "an" : "a"} {noun} with the Arel Clipper, then file it from the
        Inbox — it lands here.
      </p>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3")}>
      <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}
