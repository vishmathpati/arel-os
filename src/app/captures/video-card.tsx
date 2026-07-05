/**
 * VideoCard (D33) — renders a captured YouTube video as a YouTube-style card:
 * a 16:9 thumbnail with a duration badge, the title, and the channel. The
 * thumbnail is referenced remotely (i.ytimg.com — not downloaded). Optional
 * `actions` slot carries triage controls in the Inbox.
 */

import type { CaptureView } from "@/shared/lib/capture-view";
import { mediaSrc } from "@/shared/lib/media";
import { cn } from "@/shared/lib/utils";
import { Play } from "lucide-react";
import type { ReactNode } from "react";

/** X (Twitter) wordmark glyph. */
function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" className={className} fill="currentColor">
      <title>X</title>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.967 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

/** YouTube wordmark glyph — red rounded rect + white play triangle. */
function YtGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" role="img" className={className}>
      <title>YouTube</title>
      <path
        fill="#FF0000"
        d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z"
      />
      <path fill="#fff" d="M9.6 15.6 15.8 12 9.6 8.4Z" />
    </svg>
  );
}

interface VideoCardProps {
  view: CaptureView;
  actions?: ReactNode;
  className?: string;
}

/** Best available thumbnail: explicit field, else a thumbnail-kind media asset. */
/** Best thumbnail: explicit field, else a poster/image/thumbnail media asset
 * (a Twitter video has a `poster`, a YouTube video the remote `thumbnail`). */
function thumbOf(view: CaptureView): string | undefined {
  if (view.thumbnail) return view.thumbnail;
  const m = view.media?.find(
    (x) => x.kind === "poster" || x.kind === "thumbnail" || x.kind === "image",
  );
  return m?.url;
}

export function VideoCard({ view, actions, className }: VideoCardProps) {
  const thumb = thumbOf(view);
  const isYouTube = view.resource_kind === "video";
  const channel = view.channel ?? view.handle ?? view.author;

  return (
    <article
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div className="relative aspect-video bg-muted">
        {thumb ? (
          <img src={mediaSrc(thumb)} alt="" loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center">
            {isYouTube ? (
              <YtGlyph className="size-8 opacity-60" />
            ) : (
              <Play className="size-8 text-muted-foreground" />
            )}
          </div>
        )}
        {/* play affordance for the (silent) Twitter video poster */}
        {!isYouTube && thumb && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-black/60">
              <Play className="size-5 translate-x-0.5 fill-white text-white" />
            </span>
          </span>
        )}
        {view.duration && (
          <span className="absolute right-1.5 bottom-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[0.7rem] font-medium text-white tabular-nums">
            {view.duration}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-body font-medium leading-snug">{view.title}</h3>
        {channel && (
          <div className="flex items-center gap-1.5 text-caption text-muted-foreground">
            {isYouTube ? (
              <YtGlyph className="size-3.5 shrink-0" />
            ) : (
              <XGlyph className="size-3 shrink-0" />
            )}
            <span className="truncate">{channel}</span>
          </div>
        )}
        {actions && <div className="mt-2">{actions}</div>}
      </div>
    </article>
  );
}
