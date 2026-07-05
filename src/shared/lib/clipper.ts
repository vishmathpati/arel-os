/**
 * Clipper capture mapping (Ch9 / Ch17) — PURE and server-safe.
 *
 * The Arel Clipper Chrome extension (lives OUTSIDE this repo) POSTs a
 * ClipperPayload to the Bun vault server's `POST /inbox/clip`. This module is the
 * receiving contract: it maps a payload to an inbox markdown file (frontmatter +
 * body) and builds a collision-free inbox id. No vault I/O and no browser/node
 * deps, so both the browser inbox layer and the server endpoint share it.
 *
 * Imports stay RELATIVE (not the `@/` alias) so server/index.ts can import this
 * module — the server tsconfig has no path aliases.
 */

import { slugify } from "./vault/paths";
import type { ResourceKind } from "./vault/schemas";

/** The Arel Clipper payload. The extension calls this exact shape. */
export interface ClipperPayload {
  url: string;
  title?: string;
  /** Optional hint; falls back to URL-based detection. */
  type?: ResourceKind;
  /** Full article markdown (readability extraction). */
  article_text_markdown?: string;
  /** Tweet markdown when clipping a tweet. */
  tweet_text_markdown?: string;
  /** A highlighted selection rather than the whole page. */
  selection?: string;
  /** Site name, e.g. "The Verge". */
  source?: string;
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i;

/** The hostname of a URL, www-stripped; falls back to the raw input. */
export function hostOf(url: string): string {
  try {
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Map a URL to a resource sub-type by host / extension. */
export function resourceKindForUrl(url: string): ResourceKind {
  const host = hostOf(url).toLowerCase();
  const isX = host.includes("twitter.com") || host === "x.com" || host.endsWith(".x.com");
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "video";
  // An X long-form article (`/<handle>/article/<id>`) is its own type, not a tweet.
  if (isX && /\/article\/\d+/i.test(url)) return "article";
  if (isX) return "tweet";
  if (IMAGE_RE.test(url)) return "image";
  return "link";
}

/** Map a clipper payload to an inbox resource (frontmatter + body) — pure. */
export function articleCapture(payload: ClipperPayload): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const resource_kind = payload.type ?? resourceKindForUrl(payload.url);
  const fm: Record<string, unknown> = {
    type: "inbox",
    kind: "resource",
    title: payload.title?.trim() || hostOf(payload.url),
    resource_kind,
    url: payload.url,
    source: payload.source ?? hostOf(payload.url),
  };
  const body =
    payload.article_text_markdown ?? payload.tweet_text_markdown ?? payload.selection ?? "";
  return { frontmatter: fm, body };
}

/** Compact, sortable, human-readable capture timestamp: YYYYMMDD-HHmmss. */
export function captureStamp(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  );
}

/**
 * Build a collision-free inbox id (`<stamp>-<slug>`), given the set of ids
 * already taken in the inbox. Pure — the caller supplies `taken` (the browser
 * lists via the vault client; the server lists via io.listVaultDir).
 */
export function nextInboxId(base: string, taken: ReadonlySet<string>, now: Date): string {
  const root = `${captureStamp(now)}-${slugify(base) || "capture"}`;
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}
