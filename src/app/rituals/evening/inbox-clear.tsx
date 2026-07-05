/**
 * Inbox-clear (Ch11 / D35) — the evening Inbox-zero step. Lists every pending
 * capture with a one-tap **File** (to its default home) and **Discard**, driven
 * entirely through the existing `useInbox()` API — this file never touches the
 * Inbox feature's own components (a parallel effort owns the article integration
 * there). A disabled **"Process with AI"** button reserves the future one-click
 * that triages everything automatically (no AI built yet).
 */

import { useInbox } from "@/app/inbox/inbox-provider";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { InboxItem } from "@/shared/lib/inbox-data";
import { Bot, FileInput, Inbox, Link2, ListTodo, Trash2 } from "lucide-react";

const kindLabel = (item: InboxItem): string =>
  item.kind === "resource" ? (item.resource_kind ?? "link") : "task";

export function InboxClear() {
  const { items, loading, file, discard } = useInbox();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-subheading">
          <Inbox className="size-4 text-muted-foreground" />
          Clear the Inbox
          <span className="text-caption font-normal text-muted-foreground tabular-nums">
            {items.length}
          </span>
        </CardTitle>
        {/* Future one-click AI triage — reserved, not yet wired. */}
        <Button variant="outline" size="sm" disabled className="h-7 gap-1.5">
          <Bot className="size-3.5" />
          Process with AI
          <span className="rounded-sm bg-muted px-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Soon
          </span>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="px-1 py-2 text-caption text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-body text-success">
            <Inbox className="size-4" />
            Inbox zero — nothing to clear.
          </div>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border bg-card">
            {items.map((item) => (
              <div key={item.path} className="flex items-center gap-3 px-3 py-2.5">
                {item.kind === "resource" ? (
                  <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ListTodo className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate text-body">
                  {item.title || item.url || "Untitled"}
                </span>
                <span className="shrink-0 text-caption capitalize text-muted-foreground">
                  {kindLabel(item)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-muted-foreground"
                  onClick={() => file(item, {})}
                >
                  <FileInput className="size-3.5" />
                  File
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-error"
                  aria-label="Discard"
                  onClick={() => discard(item)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
