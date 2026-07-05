/**
 * Inbox data layer (Chapter 9, D5/D32) — the universal parking lot. Every
 * capture lands as one markdown file under `inbox/` with `type: inbox`, waiting
 * to be triaged. Triage files it to its real home: a task → `tasks/`, a
 * resource → `pages/` (the Library filter). Filing soft-deletes the inbox file.
 *
 * Capture is zero-friction: one field, type + Enter. Kind is auto-detected
 * (URL → resource, `task:` prefix → task, plain text → task) and is never
 * locked — it is corrected during triage. The detection + clipper-payload
 * mapping are pure functions (testable without the vault server); only the
 * id/write wrappers touch the network. Browser-only; reads fresh every call.
 */

import { areaWikilink } from "@/shared/lib/areas";
import {
  type ClipperPayload,
  articleCapture,
  hostOf,
  nextInboxId,
  resourceKindForUrl,
} from "@/shared/lib/clipper";
import { createResource } from "@/shared/lib/resource-data";
import { createTask } from "@/shared/lib/tasks/tasks";
import { deleteDoc, listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import { toWikilink } from "@/shared/lib/vault/frontmatter";
import { inboxPath } from "@/shared/lib/vault/paths";
import type {
  CaptureFields,
  InboxFrontmatter,
  InboxKind,
  ResourceKind,
  VaultDoc,
} from "@/shared/lib/vault/schemas";

// Re-exported so existing inbox importers (and tests) keep their import site.
export type { ClipperPayload } from "@/shared/lib/clipper";
export { articleCapture, resourceKindForUrl } from "@/shared/lib/clipper";

/** An in-memory inbox item: its frontmatter, flattened, plus path/id/body. */
export interface InboxItem extends InboxFrontmatter {
  /** Relative vault path, e.g. "inbox/20260616-153012-buy-milk.md". */
  path: string;
  /** Filename stem (the capture id). */
  id: string;
  /** Markdown body — clipped article text, tweet text, or notes. */
  body: string;
}

/** The detected shape of a raw capture, before it becomes a file. */
export interface CaptureDetection {
  kind: InboxKind;
  title: string;
  resource_kind?: ResourceKind;
  url?: string;
  source?: string;
}

const URL_RE = /^(https?:\/\/|www\.)\S+$/i;

/**
 * Auto-detect what a raw capture is (D32). `task:` prefix → task; a bare URL →
 * resource (sub-type by host); anything else → task. The kind is a default,
 * not a lock — triage can flip it.
 */
export function detectCapture(raw: string): CaptureDetection {
  const text = raw.trim();
  const taskMatch = /^task:\s*/i.exec(text);
  if (taskMatch) {
    return { kind: "task", title: text.slice(taskMatch[0].length).trim() || "Untitled" };
  }
  if (URL_RE.test(text)) {
    return {
      kind: "resource",
      title: hostOf(text),
      resource_kind: resourceKindForUrl(text),
      url: text,
      source: hostOf(text),
    };
  }
  return { kind: "task", title: text };
}

/** Build inbox frontmatter from a detection (pure — no id, no write). */
export function captureFrontmatter(d: CaptureDetection): Record<string, unknown> {
  const fm: Record<string, unknown> = { type: "inbox", kind: d.kind, title: d.title };
  if (d.resource_kind) fm.resource_kind = d.resource_kind;
  if (d.url) fm.url = d.url;
  if (d.source) fm.source = d.source;
  return fm;
}

function toItem(doc: VaultDoc<InboxFrontmatter>): InboxItem {
  const id = doc.path.replace(/^inbox\//, "").replace(/\.md$/, "");
  return { ...doc.frontmatter, path: doc.path, id, body: doc.body };
}

/** Strip the in-memory-only fields back to a plain frontmatter object. */
function frontmatterOf(item: InboxItem): Record<string, unknown> {
  const { path: _p, id: _i, body: _b, ...fm } = item;
  return fm;
}

/** Pull the rich capture fields off an inbox item to carry to its resource (D33). */
function captureOf(item: InboxItem): CaptureFields {
  return {
    author: item.author,
    handle: item.handle,
    profile_image: item.profile_image,
    text_markdown: item.text_markdown,
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

async function uniqueId(base: string, now: Date): Promise<string> {
  const { entries } = await listDir("inbox");
  const taken = new Set(
    entries
      .filter((e) => e.type === "file" && e.path.endsWith(".md"))
      .map((e) => e.path.replace(/^inbox\//, "").replace(/\.md$/, "")),
  );
  return nextInboxId(base, taken, now);
}

/** All current (non-deleted) inbox items, read fresh, newest first. */
export async function listInbox(): Promise<InboxItem[]> {
  const { entries } = await listDir("inbox");
  const files = entries.filter((e) => e.type === "file" && e.path.endsWith(".md"));
  const docs = await Promise.all(files.map((e) => readDoc(e.path).catch(() => null)));
  return docs
    .filter(
      (d): d is VaultDoc<InboxFrontmatter> =>
        d?.frontmatter?.type === "inbox" && !d.frontmatter.deleted,
    )
    .map(toItem)
    .sort((a, b) => b.id.localeCompare(a.id));
}

/** Capture a raw string into the inbox (auto-detected). Returns the new item. */
export async function captureInbox(raw: string, now: Date = new Date()): Promise<InboxItem> {
  const detection = detectCapture(raw);
  const id = await uniqueId(detection.title, now);
  const res = await writeDoc(inboxPath(id), captureFrontmatter(detection), "");
  return toItem({ path: res.path, frontmatter: res.frontmatter as InboxFrontmatter, body: "" });
}

/** Capture a clipper payload into the inbox (Act 5 pre-wire). */
export async function captureArticle(
  payload: ClipperPayload,
  now: Date = new Date(),
): Promise<InboxItem> {
  const { frontmatter, body } = articleCapture(payload);
  const id = await uniqueId(String(frontmatter.title ?? "capture"), now);
  const res = await writeDoc(inboxPath(id), frontmatter, body);
  return toItem({ path: res.path, frontmatter: res.frontmatter as InboxFrontmatter, body });
}

/** Patch an inbox item's frontmatter (used by triage before filing). */
export async function updateInbox(
  item: InboxItem,
  patch: Partial<InboxFrontmatter>,
): Promise<InboxItem> {
  const frontmatter = { ...frontmatterOf(item), ...patch };
  for (const key of Object.keys(patch) as (keyof InboxFrontmatter)[]) {
    if (patch[key] === undefined) delete frontmatter[key];
  }
  const res = await writeDoc(item.path, frontmatter, item.body);
  return toItem({
    path: item.path,
    frontmatter: res.frontmatter as InboxFrontmatter,
    body: item.body,
  });
}

/** Where a triaged item is being filed. */
export interface FileDestination {
  area?: string;
  project?: string;
  quest?: string;
}

/**
 * File an inbox item to its real home, then soft-delete the inbox file. A task
 * lands in `tasks/` (unscheduled — the user times it later); a resource lands in
 * `pages/` as `type: resource`, carrying its url + clipped body to the Library.
 */
export async function fileInbox(item: InboxItem, dest: FileDestination): Promise<void> {
  if (item.kind === "resource") {
    await createResource({
      title: item.title ?? item.url ?? "Untitled",
      resource_kind: item.resource_kind,
      url: item.url,
      source: item.source,
      area: dest.area,
      project: dest.project,
      quest: dest.quest,
      body: item.body || undefined,
      capture: captureOf(item),
    });
  } else {
    const task = await createTask({
      title: item.title ?? "Untitled",
      schedule: "unscheduled",
      area: dest.area ? areaWikilink(dest.area) : undefined,
      project: dest.project ? toWikilink(dest.project) : undefined,
      quest: dest.quest ? toWikilink(dest.quest) : undefined,
    });
    // Carry any captured notes as the task body.
    if (item.body.trim()) {
      const { updateTask } = await import("@/shared/lib/tasks/tasks");
      await updateTask(task, {}, item.body);
    }
  }
  await deleteDoc(item.path);
}

/** Discard an inbox item without filing (soft-delete). */
export async function discardInbox(item: InboxItem): Promise<void> {
  await deleteDoc(item.path);
}
