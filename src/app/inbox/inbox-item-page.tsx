/**
 * InboxItemPage (D37) — reads a captured inbox item (an X article, tweet, or
 * thread) in our own Plate editor at `/inbox/:id`, BEFORE it is filed. The full
 * downloaded text + local images live in the markdown body, so the read is
 * permanent and independent of X. A quiet "View original on X" link remains; the
 * primary action is "File to Library" (it becomes a Page there).
 */

import { DetailShell, InlineTitle } from "@/app/detail/detail-kit";
import { PageBody } from "@/app/editor/page-body";
import { useInbox } from "@/app/inbox/inbox-provider";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { InboxItem } from "@/shared/lib/inbox-data";
import { mediaSrc } from "@/shared/lib/media";
import { readDoc, writeDoc } from "@/shared/lib/vault/client";
import { inboxPath } from "@/shared/lib/vault/paths";
import type { InboxFrontmatter } from "@/shared/lib/vault/schemas";
import { ArrowUpRight, FileText, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function toItem(path: string, fm: InboxFrontmatter, body: string): InboxItem {
  const id = path.replace(/^inbox\//, "").replace(/\.md$/, "");
  return { ...fm, path, id, body };
}

export function InboxItemPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { file } = useInbox();
  const path = inboxPath(id ?? "");

  const [fm, setFm] = useState<InboxFrontmatter | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    readDoc(path)
      .then((d) => {
        if (!live) return;
        setFm(d.frontmatter as unknown as InboxFrontmatter);
        setBody(d.body);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Couldn't load"))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [path]);

  const saveTitle = useCallback(
    (title: string) => {
      if (!fm) return;
      const next = { ...fm, title };
      setFm(next);
      void writeDoc(path, next as unknown as Record<string, unknown>, body);
    },
    [fm, body, path],
  );

  const saveBody = useCallback(
    (markdown: string) => {
      setBody(markdown);
      if (fm) void writeDoc(path, fm as unknown as Record<string, unknown>, markdown);
    },
    [fm, path],
  );

  const onFile = useCallback(() => {
    if (!fm) return;
    void file(toItem(path, fm, body), {});
    navigate("/inbox");
  }, [fm, body, path, file, navigate]);

  if (loading) {
    return (
      <DetailShell crumbs={[{ label: "Inbox" }, { label: "Loading…" }]}>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-5/6" />
      </DetailShell>
    );
  }

  if (error || !fm) {
    return (
      <DetailShell crumbs={[{ label: "Inbox" }, { label: "Not found" }]}>
        <Alert variant="destructive">
          <AlertTitle>Couldn't open this capture</AlertTitle>
          <AlertDescription>{error ?? "It may have been filed or discarded."}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-fit"
            onClick={() => navigate("/inbox")}
          >
            Back to Inbox
          </Button>
        </Alert>
      </DetailShell>
    );
  }

  const isArticle = fm.resource_kind === "article";

  return (
    <DetailShell crumbs={[{ label: "Inbox" }, { label: fm.title || "Capture" }]}>
      <div className="mx-auto max-w-3xl">
        {isArticle && (
          <div className="mb-2 flex items-center gap-1.5 text-caption text-muted-foreground">
            <FileText className="size-3.5" />
            <span>Article{fm.source ? ` · ${fm.source}` : ""}</span>
          </div>
        )}

        <InlineTitle value={fm.title ?? ""} onSave={saveTitle} />

        {(fm.author || fm.handle) && (
          <div className="mt-3 flex items-center gap-2">
            <Avatar className="size-7">
              {fm.profile_image && <AvatarImage src={mediaSrc(fm.profile_image)} alt="" />}
              <AvatarFallback className="text-caption">
                {(fm.author ?? fm.handle ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-body font-medium">{fm.author}</span>
            {fm.handle && <span className="text-caption text-muted-foreground">{fm.handle}</span>}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          <Button size="sm" onClick={onFile}>
            <Sparkles className="size-3.5" />
            File to Library
          </Button>
          {fm.url && (
            <a
              href={fm.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
            >
              View original on X
              <ArrowUpRight className="size-3.5" />
            </a>
          )}
        </div>

        <div className="mt-6 border-border border-t pt-4">
          <PageBody
            parentSlug={id ?? "capture"}
            body={body}
            onSaveBody={saveBody}
            placeholder="The captured content lives here…"
          />
        </div>
      </div>
    </DetailShell>
  );
}
