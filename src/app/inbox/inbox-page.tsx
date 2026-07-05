/**
 * InboxPage — the universal parking lot surface (Chapter 9, D32 · rich views
 * D33). Consumes the global InboxProvider (one state, shared with the sidebar
 * badge + ⌘N capture). A lens toolbar filters the set: All / Tasks render as the
 * triage table; Tweets render as a Twitter-style feed and Videos as a
 * YouTube-style grid (rich cards, compact triage footer); Links is the table of
 * the remaining resources. Empty = inbox-zero.
 */

import { ArticleCard } from "@/app/captures/article-card";
import { CaptureTriageBar } from "@/app/captures/capture-triage-bar";
import { TweetCard } from "@/app/captures/tweet-card";
import { VideoCard } from "@/app/captures/video-card";
import { useInbox } from "@/app/inbox/inbox-provider";
import { INBOX_GRID, InboxRow } from "@/app/inbox/inbox-row";
import { PageHeader } from "@/app/page-header";
import { useProjects } from "@/app/projects/use-projects";
import { useQuests } from "@/app/quests/use-quests";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { areaSlug } from "@/shared/lib/areas";
import {
  type TweetGroup,
  captureFromInbox,
  isTweetCapture,
  isVideoCapture,
  tweetGroup,
} from "@/shared/lib/capture-view";
import type { InboxItem } from "@/shared/lib/inbox-data";
import { cn } from "@/shared/lib/utils";
import { CheckCircle2, Plus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Lens = "all" | "task" | "tweet" | "video" | "article" | "link";

const LENSES: ReadonlyArray<{ key: Lens; label: string }> = [
  { key: "all", label: "All" },
  { key: "task", label: "Tasks" },
  { key: "tweet", label: "Tweets" },
  { key: "video", label: "Videos" },
  { key: "article", label: "Articles" },
  { key: "link", label: "Links" },
];

const isArticle = (i: InboxItem) => i.kind === "resource" && i.resource_kind === "article";
const isLink = (i: InboxItem) =>
  i.kind === "resource" && !isTweetCapture(i) && !isVideoCapture(i) && !isArticle(i);

function matchesLens(i: InboxItem, lens: Lens): boolean {
  switch (lens) {
    case "all":
      return true;
    case "task":
      return i.kind === "task";
    case "tweet":
      return isTweetCapture(i); // tweets/replies/threads/quotes, but not video-tweets
    case "video":
      return isVideoCapture(i); // YouTube + Twitter videos
    case "article":
      return isArticle(i);
    case "link":
      return isLink(i);
  }
}

const TWEET_GROUPS: ReadonlyArray<{ key: TweetGroup; label: string }> = [
  { key: "tweets", label: "Tweets" },
  { key: "replies", label: "Replies" },
  { key: "threads", label: "Threads" },
];

export function InboxPage() {
  const { items, loading, error, reload, patch, file, discard, capture } = useInbox();
  const { projects } = useProjects();
  const { quests } = useQuests();
  const navigate = useNavigate();

  const projectOptions = useMemo(
    () =>
      projects.map((p) => ({
        slug: p.slug,
        title: p.title ?? p.slug,
        area: areaSlug(p.area) ?? "",
      })),
    [projects],
  );
  const questOptions = useMemo(
    () =>
      quests.map((q) => ({ slug: q.slug, title: q.title ?? q.slug, area: areaSlug(q.area) ?? "" })),
    [quests],
  );

  const [lens, setLens] = useState<Lens>("all");
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const taskCount = useMemo(() => items.filter((i) => i.kind === "task").length, [items]);
  const resourceCount = items.length - taskCount;

  const filtered = useMemo(() => items.filter((i) => matchesLens(i, lens)), [items, lens]);

  const toggleExpand = useCallback((item: InboxItem) => {
    setExpandedPath((prev) => (prev === item.path ? null : item.path));
  }, []);

  const submitDraft = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await capture(text);
  };

  const rowProps = {
    onToggleExpand: toggleExpand,
    onPatch: patch,
    onFile: file,
    onDiscard: discard,
    projectOptions,
    questOptions,
  };

  const body = loading ? (
    <LoadingTable />
  ) : error ? (
    <Alert variant="destructive">
      <AlertTitle>Couldn't load the inbox</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
      <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
        Retry
      </Button>
    </Alert>
  ) : filtered.length === 0 ? (
    <EmptyState lens={lens} hasItems={items.length > 0} />
  ) : lens === "tweet" ? (
    <div className="mx-auto max-w-xl space-y-6">
      {TWEET_GROUPS.map(({ key, label }) => {
        const group = filtered.filter((i) => tweetGroup(i) === key);
        if (group.length === 0) return null;
        return (
          <div key={key}>
            <div className="mb-2 flex items-center gap-2 text-caption text-muted-foreground">
              <span className="font-medium">{label}</span>
              <span className="tabular-nums">{group.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {group.map((item) => (
                <TweetCard
                  key={item.path}
                  view={captureFromInbox(item)}
                  actions={<CaptureTriageBar item={item} onFile={file} onDiscard={discard} />}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  ) : lens === "video" ? (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((item) => (
        <VideoCard
          key={item.path}
          view={captureFromInbox(item)}
          actions={<CaptureTriageBar item={item} onFile={file} onDiscard={discard} />}
        />
      ))}
    </div>
  ) : lens === "article" ? (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      {filtered.map((item) => (
        <ArticleCard
          key={item.path}
          view={captureFromInbox(item)}
          onOpen={() => navigate(`/inbox/${item.id}`)}
          actions={<CaptureTriageBar item={item} onFile={file} onDiscard={discard} />}
        />
      ))}
    </div>
  ) : (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div
        className={cn(INBOX_GRID, "h-8 border-b border-border text-caption text-muted-foreground")}
      >
        <span />
        <span>Item</span>
        <span>Type</span>
        <span>Captured</span>
      </div>
      {filtered.map((item) => (
        <InboxRow key={item.path} item={item} expanded={expandedPath === item.path} {...rowProps} />
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={[{ label: "Inbox" }]} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {/* Header band */}
          <div className="flex items-baseline justify-between">
            <h1 className="text-heading font-semibold tracking-tight">Inbox</h1>
            <span className="text-caption text-muted-foreground">
              {items.length === 0
                ? "All clear"
                : `${items.length} to triage · ${taskCount} task${taskCount === 1 ? "" : "s"}, ${resourceCount} resource${resourceCount === 1 ? "" : "s"}`}
            </span>
          </div>

          {/* Toolbar */}
          <div className="mt-6 flex items-center gap-1">
            {LENSES.map(({ key, label }) => (
              <Button
                key={key}
                variant="ghost"
                size="sm"
                className={cn(
                  "text-muted-foreground",
                  lens === key && "bg-accent text-accent-foreground",
                )}
                onClick={() => setLens(key)}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* In-page capture */}
          <div className="mt-3 flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4">
            <Plus className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitDraft()}
              placeholder="Capture anything…  (⌘N from anywhere)"
              className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>

          <div className="mt-4">{body}</div>
        </div>
      </div>
    </div>
  );
}

function LoadingTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {[0, 1, 2, 3].map((r) => (
        <div key={r} className={cn(INBOX_GRID, "h-11 border-b border-border/60")}>
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3.5 w-12" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ lens, hasItems }: { lens: Lens; hasItems: boolean }) {
  const labels: Record<Lens, string> = {
    all: "",
    task: "No tasks to triage",
    tweet: "No tweets captured",
    video: "No videos captured",
    article: "No articles captured",
    link: "No links to triage",
  };
  const heading = hasItems ? labels[lens] || "Nothing here" : "Inbox is clear";
  const body = hasItems
    ? "Switch to All to see everything still waiting."
    : "Everything's been filed. Capture a thought, task, or link with ⌘N — it lands here to triage later.";
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-16 text-center">
      <CheckCircle2 className="size-5 text-success" />
      <h2 className="mt-3 text-subheading font-medium">{heading}</h2>
      <p className="mt-1 max-w-sm text-body text-muted-foreground">{body}</p>
    </div>
  );
}
