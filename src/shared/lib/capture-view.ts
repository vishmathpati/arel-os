/**
 * CaptureView (D33) — the normalized shape the rich tweet/video cards consume,
 * derived from either an Inbox item or a Library resource row (both carry the
 * same `CaptureFields`). Keeping one view model means TweetCard / VideoCard are
 * written once and reused across the Inbox and the Library.
 */

import type { DbRow } from "@/shared/lib/db-rows";
import type { InboxItem } from "@/shared/lib/inbox-data";
import type {
  CaptureFields,
  CaptureMedia,
  CaptureRef,
  ResourceKind,
} from "@/shared/lib/vault/schemas";

export interface CaptureView extends CaptureFields {
  title: string;
  url?: string;
  source?: string;
  resource_kind?: ResourceKind;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v : undefined);

// ── Capture routing predicates (D37) ─────────────────────────────────────────
// A "capture-like" is anything carrying the fields the tabs route on — both an
// InboxItem and a CaptureView satisfy it.
type CaptureLike = Pick<CaptureFields, "media" | "tweet_subtype" | "reply_to" | "thread_items"> & {
  resource_kind?: ResourceKind;
};

/** Does this capture carry a video (a YouTube video, or a tweet with video media)? */
export function hasVideoMedia(c: CaptureLike): boolean {
  return (c.media ?? []).some((m) => m.kind === "video" || m.kind === "poster");
}

/** Belongs in the Videos tab: a YouTube video OR a tweet whose media is a video. */
export function isVideoCapture(c: CaptureLike): boolean {
  return c.resource_kind === "video" || (c.resource_kind === "tweet" && hasVideoMedia(c));
}

/** Belongs in the Tweets tab: a tweet that is NOT a video. */
export function isTweetCapture(c: CaptureLike): boolean {
  return c.resource_kind === "tweet" && !hasVideoMedia(c);
}

export type TweetGroup = "threads" | "replies" | "tweets";

/** Which sub-group of the Tweets tab a tweet belongs to. */
export function tweetGroup(c: CaptureLike): TweetGroup {
  if (c.tweet_subtype === "thread" || (c.thread_items?.length ?? 0) > 0) return "threads";
  if (c.tweet_subtype === "reply" || c.reply_to) return "replies";
  return "tweets";
}

/** Build a view from an Inbox item (already typed CaptureFields). */
export function captureFromInbox(item: InboxItem): CaptureView {
  return {
    title: item.title ?? item.url ?? "Untitled",
    url: item.url,
    source: item.source,
    resource_kind: item.resource_kind,
    author: item.author,
    handle: item.handle,
    profile_image: item.profile_image,
    text_markdown: item.text_markdown ?? (item.body || undefined),
    tweet_id: item.tweet_id,
    tweet_subtype: item.tweet_subtype,
    quoted_tweet: item.quoted_tweet,
    reply_to: item.reply_to,
    thread_items: item.thread_items,
    channel: item.channel,
    channel_url: item.channel_url,
    thumbnail: item.thumbnail,
    duration: item.duration,
    video_id: item.video_id,
    media: item.media,
  };
}

/** Build a view from a Library row (loosely-typed frontmatter map). */
export function captureFromRow(row: DbRow): CaptureView {
  const fm = row.frontmatter;
  return {
    title: row.title,
    url: str(fm.url),
    source: str(fm.source),
    resource_kind: str(fm.resource_kind) as ResourceKind | undefined,
    author: str(fm.author),
    handle: str(fm.handle),
    profile_image: str(fm.profile_image),
    text_markdown: str(fm.text_markdown) ?? (row.body || undefined),
    tweet_id: str(fm.tweet_id),
    tweet_subtype: str(fm.tweet_subtype),
    quoted_tweet: fm.quoted_tweet as CaptureRef | undefined,
    reply_to: fm.reply_to as CaptureRef | undefined,
    thread_items: fm.thread_items as CaptureRef[] | undefined,
    channel: str(fm.channel),
    channel_url: str(fm.channel_url),
    thumbnail: str(fm.thumbnail),
    duration: str(fm.duration),
    video_id: str(fm.video_id),
    media: fm.media as CaptureMedia[] | undefined,
  };
}
