/**
 * TweetCard (D33) — renders a captured tweet as a Twitter-style card: avatar,
 * name, @handle, linkified text, a media grid, and any quoted tweet / thread
 * items. Presentational only; an optional `actions` slot carries triage
 * controls in the Inbox. Reused by the Inbox Tweets feed and the Library.
 */

import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import type { CaptureView } from "@/shared/lib/capture-view";
import { mediaSrc } from "@/shared/lib/media";
import { cn } from "@/shared/lib/utils";
import type { CaptureMedia, CaptureRef } from "@/shared/lib/vault/schemas";
import { Play, Reply } from "lucide-react";
import type { ReactNode } from "react";

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" className={className} fill="currentColor">
      <title>X</title>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

function initials(name: string | undefined, handle: string | undefined): string {
  const base = name?.trim() || handle?.replace(/^@/, "") || "?";
  return base.slice(0, 2).toUpperCase();
}

const SUBTYPE_LABEL: Record<string, string> = {
  reply: "Reply",
  repost: "Reposted",
  quote: "Quote",
  thread: "Thread",
};

/** Linkify @mentions, #hashtags and URLs; preserve line breaks. */
function TweetText({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <p className="whitespace-pre-wrap break-words text-body leading-relaxed">
      {parts.map((part, i) => {
        if (/^https?:\/\//.test(part) || /^@\w+$/.test(part) || /^#\w+$/.test(part)) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: token order is the identity.
            <span key={i} className="text-info">
              {/^https?:\/\//.test(part) ? part.replace(/^https?:\/\/(www\.)?/, "") : part}
            </span>
          );
        }
        // biome-ignore lint/suspicious/noArrayIndexKey: token order is the identity.
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function MediaGrid({ media, compact }: { media: CaptureMedia[]; compact?: boolean }) {
  const items = media.filter((m) => m.kind !== "thumbnail").slice(0, 4);
  if (items.length === 0) return null;
  return (
    <div
      className={cn(
        "mt-3 grid gap-0.5 overflow-hidden rounded-2xl border border-border",
        items.length === 1 ? "grid-cols-1" : "grid-cols-2",
      )}
    >
      {items.map((m, i) => {
        const isVideo = m.kind === "video" || m.kind === "poster";
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: media order is the identity.
            key={i}
            className={cn(
              "relative bg-muted",
              items.length === 1 ? "aspect-video" : "aspect-square",
              items.length === 3 && i === 0 && "row-span-2 aspect-auto",
            )}
          >
            <img
              src={mediaSrc(m.url)}
              alt={m.alt ?? ""}
              loading="lazy"
              className="size-full object-cover"
            />
            {isVideo && (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-black/60">
                  <Play className="size-5 translate-x-0.5 fill-white text-white" />
                </span>
              </span>
            )}
          </div>
        );
      })}
      {compact && null}
    </div>
  );
}

function QuotedTweet({ quote: q }: { quote: CaptureRef }) {
  return (
    <div className="mt-3 rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <Avatar className="size-5">
          {q.profile_image && <AvatarImage src={mediaSrc(q.profile_image)} alt="" />}
          <AvatarFallback className="text-[0.6rem]">{initials(q.author, q.handle)}</AvatarFallback>
        </Avatar>
        <span className="truncate text-caption font-medium">{q.author}</span>
        {q.handle && (
          <span className="truncate text-caption text-muted-foreground">{q.handle}</span>
        )}
      </div>
      {q.text_markdown && (
        <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-caption text-muted-foreground">
          {q.text_markdown}
        </p>
      )}
      {q.media && q.media.length > 0 && <MediaGrid media={q.media} compact />}
    </div>
  );
}

function ReplyContext({ to }: { to: CaptureRef }) {
  return (
    <div className="mt-1">
      <span className="flex items-center gap-1 text-caption text-muted-foreground">
        <Reply className="size-3" />
        Replying to {to.handle ?? to.author ?? "a tweet"}
      </span>
      {to.text_markdown && (
        <div className="mt-1.5 border-border border-l-2 pl-3">
          <div className="flex items-center gap-1.5">
            <Avatar className="size-4">
              {to.profile_image && <AvatarImage src={mediaSrc(to.profile_image)} alt="" />}
              <AvatarFallback className="text-[0.55rem]">
                {initials(to.author, to.handle)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-caption font-medium">{to.author}</span>
            {to.handle && (
              <span className="truncate text-caption text-muted-foreground">{to.handle}</span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap break-words text-caption text-muted-foreground">
            {to.text_markdown}
          </p>
        </div>
      )}
    </div>
  );
}

interface TweetCardProps {
  view: CaptureView;
  actions?: ReactNode;
  className?: string;
}

export function TweetCard({ view, actions, className }: TweetCardProps) {
  const text = view.text_markdown ?? "";
  const subtype = view.tweet_subtype && SUBTYPE_LABEL[view.tweet_subtype];
  const threads = view.thread_items ?? [];

  return (
    <article className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      {subtype && <div className="mb-2 text-caption text-muted-foreground">{subtype}</div>}
      <div className="flex gap-3">
        <Avatar className="size-10 shrink-0">
          {view.profile_image && <AvatarImage src={mediaSrc(view.profile_image)} alt="" />}
          <AvatarFallback>{initials(view.author, view.handle)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 leading-tight">
              <div className="truncate text-body font-semibold">{view.author ?? view.title}</div>
              {view.handle && (
                <div className="truncate text-caption text-muted-foreground">{view.handle}</div>
              )}
            </div>
            {view.url ? (
              <a
                href={view.url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <XGlyph className="size-4" />
              </a>
            ) : (
              <XGlyph className="size-4 shrink-0 text-muted-foreground" />
            )}
          </div>

          {view.reply_to && <ReplyContext to={view.reply_to} />}
          {text && <div className="mt-1.5">{<TweetText text={text} />}</div>}
          {view.media && view.media.length > 0 && <MediaGrid media={view.media} />}
          {view.quoted_tweet && <QuotedTweet quote={view.quoted_tweet} />}

          {threads.length > 0 && (
            <div className="mt-3 space-y-3 border-l-2 border-border pl-3">
              {threads.map((item, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: thread order is the identity.
                <div key={i}>
                  {item.text_markdown && (
                    <p className="whitespace-pre-wrap break-words text-body leading-relaxed">
                      {item.text_markdown}
                    </p>
                  )}
                  {item.media && item.media.length > 0 && <MediaGrid media={item.media} />}
                </div>
              ))}
            </div>
          )}

          {actions && <div className="mt-3">{actions}</div>}
        </div>
      </div>
    </article>
  );
}
