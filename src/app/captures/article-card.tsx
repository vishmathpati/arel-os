/**
 * ArticleCard (D36) — renders a captured X (Twitter) long-form article as its own
 * card: a cover image, the title, a byline (author + @handle), and a body
 * excerpt, with a "Read on X" link. Distinct from TweetCard because an X article
 * is long-form, not a status. Reused by the Inbox Articles feed and the Library.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import type { CaptureView } from "@/shared/lib/capture-view";
import { mediaSrc } from "@/shared/lib/media";
import { cn } from "@/shared/lib/utils";
import { ArrowUpRight, FileText } from "lucide-react";
import type { ReactNode } from "react";

interface ArticleCardProps {
  view: CaptureView;
  actions?: ReactNode;
  /** Open the full captured article in our editor (the cover + title + body). */
  onOpen?: () => void;
  className?: string;
}

function initials(name: string | undefined, handle: string | undefined): string {
  const base = name?.trim() || handle?.replace(/^@/, "") || "?";
  return base.slice(0, 2).toUpperCase();
}

/** First non-thumbnail image — the article cover. */
function coverOf(view: CaptureView): string | undefined {
  return view.media?.find((m) => m.kind === "image" || m.kind === "poster")?.url;
}

/** Strip leading markdown heading/marks for a clean excerpt. */
function excerptOf(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return text
    .replace(/^#{1,6}\s+.*$/m, "")
    .replace(/[*_`>#]/g, "")
    .trim()
    .slice(0, 280);
}

export function ArticleCard({ view, actions, onOpen, className }: ArticleCardProps) {
  const cover = coverOf(view);
  const excerpt = excerptOf(view.text_markdown);

  const Body = (
    <>
      {cover && (
        <div className="aspect-[16/7] bg-muted">
          <img src={mediaSrc(cover)} alt="" loading="lazy" className="size-full object-cover" />
        </div>
      )}
      <div className="flex flex-col gap-3 p-4 pb-0">
        <div className="flex items-center gap-2 text-caption text-muted-foreground">
          <FileText className="size-3.5" />
          <span>Article</span>
          {view.source && <span className="text-muted-foreground/60">· {view.source}</span>}
        </div>

        <h3 className="text-subheading font-semibold leading-snug">{view.title}</h3>

        {(view.author || view.handle) && (
          <div className="flex items-center gap-2">
            <Avatar className="size-6">
              {view.profile_image && <AvatarImage src={mediaSrc(view.profile_image)} alt="" />}
              <AvatarFallback className="text-[0.6rem]">
                {initials(view.author, view.handle)}
              </AvatarFallback>
            </Avatar>
            <span className="text-caption font-medium">{view.author}</span>
            {view.handle && (
              <span className="text-caption text-muted-foreground">{view.handle}</span>
            )}
          </div>
        )}

        {excerpt && (
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-body text-muted-foreground">
            {excerpt}
          </p>
        )}
      </div>
    </>
  );

  return (
    <article className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="block w-full cursor-pointer text-left transition-colors hover:bg-hover/40"
        >
          {Body}
        </button>
      ) : (
        Body
      )}

      <div className="flex items-center justify-between gap-2 p-4 pt-3">
        <div className="flex items-center gap-3">
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              className="flex items-center gap-1 text-caption text-info hover:underline"
            >
              Read in editor
              <ArrowUpRight className="size-3.5" />
            </button>
          )}
          {view.url && (
            <a
              href={view.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
            >
              View on X
            </a>
          )}
        </div>
        {actions}
      </div>
    </article>
  );
}
