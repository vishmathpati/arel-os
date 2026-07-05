/**
 * Resource data layer (Chapter 8, D5/D7) — the Library is the master Resources
 * Database. A Resource IS a Page (`type: resource`) living FLAT in `pages/`
 * alongside pages, split by frontmatter type (BRIEF judgment call #3). The
 * Library is therefore a *filter* (`type: resource`), not a folder; a Project's
 * or Quest's resources are the same filter narrowed by `project`/`quest` — no
 * data duplication (Contract, Ch8).
 *
 * Library columns are FIXED (derived from ResourceFrontmatter); they are not
 * user-editable like a custom database's. Browser-only; reads fresh every call.
 */

import { type DbRow, toRow } from "@/shared/lib/db-rows";
import { listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import { pagePath, slugify } from "@/shared/lib/vault/paths";
import type {
  CaptureFields,
  DatabaseColumn,
  ResourceFrontmatter,
  ResourceKind,
  VaultDoc,
} from "@/shared/lib/vault/schemas";

/** The fixed Library columns (besides the implicit title column). `area`,
 * `project`, and `quest` are relations — display-only this chapter. */
export const LIBRARY_COLUMNS: DatabaseColumn[] = [
  {
    key: "resource_kind",
    label: "Type",
    type: "select",
    options: ["link", "tweet", "video", "image", "note", "article"],
  },
  { key: "url", label: "Source", type: "url" },
  { key: "area", label: "Area", type: "relation" },
  { key: "status", label: "Status", type: "select", options: ["unsorted", "filed"] },
  { key: "project", label: "Project", type: "relation" },
  { key: "quest", label: "Quest", type: "relation" },
];

export interface CreateResourceInput {
  title: string;
  resource_kind?: ResourceKind;
  url?: string;
  source?: string;
  area?: string;
  project?: string;
  quest?: string;
  /** Markdown body — e.g. a clipped article carried in from the Inbox. */
  body?: string;
  /** Rich capture metadata (tweet/video fields) carried from the Inbox (D33). */
  capture?: CaptureFields;
}

/** Capture-field keys copied verbatim onto a resource (D33). */
const CAPTURE_KEYS: readonly (keyof CaptureFields)[] = [
  "author",
  "handle",
  "profile_image",
  "text_markdown",
  "tweet_id",
  "tweet_subtype",
  "quoted_tweet",
  "reply_to",
  "thread_items",
  "channel",
  "channel_url",
  "thumbnail",
  "duration",
  "video_id",
  "media",
];

function isResourceDoc(d: VaultDoc | null): d is VaultDoc<ResourceFrontmatter> {
  return d?.frontmatter?.type === "resource" && !d.frontmatter.deleted;
}

/** All Library resources, optionally narrowed to an area / project / quest. */
export async function listResources(filter?: {
  area?: string;
  project?: string;
  quest?: string;
}): Promise<DbRow[]> {
  const { entries } = await listDir("pages");
  const files = entries.filter((e) => e.type === "file" && e.path.endsWith(".md"));
  const docs = await Promise.all(files.map((e) => readDoc(e.path).catch(() => null)));
  return docs
    .filter(isResourceDoc)
    .filter((d) => {
      const fm = d.frontmatter as unknown as Record<string, unknown>;
      if (filter?.area && wikiTarget(String(fm.area ?? "")) !== filter.area) return false;
      if (filter?.project && wikiTarget(String(fm.project ?? "")) !== filter.project) return false;
      if (filter?.quest && wikiTarget(String(fm.quest ?? "")) !== filter.quest) return false;
      return true;
    })
    .map((d) => toRow(d.path, d.frontmatter as unknown as Record<string, unknown>, d.body));
}

async function takenSlugs(): Promise<Set<string>> {
  const { entries } = await listDir("pages");
  return new Set(
    entries
      .filter((e) => e.type === "file" && e.path.endsWith(".md"))
      .map((e) => e.path.replace(/^pages\//, "").replace(/\.md$/, "")),
  );
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "untitled";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/** Create a Library resource (a `type: resource` Page in `pages/`). */
export async function createResource(input: CreateResourceInput): Promise<DbRow> {
  const slug = uniqueSlug(slugify(input.title), await takenSlugs());
  const frontmatter: Record<string, unknown> = {
    type: "resource",
    title: input.title,
    resource_kind: input.resource_kind ?? "link",
    status: "unsorted",
  };
  if (input.url) frontmatter.url = input.url;
  if (input.source) frontmatter.source = input.source;
  if (input.area) frontmatter.area = toWikilink(input.area);
  if (input.project) frontmatter.project = toWikilink(input.project);
  if (input.quest) frontmatter.quest = toWikilink(input.quest);

  // Carry rich capture metadata (tweet/video fields) verbatim (D33).
  if (input.capture) {
    for (const key of CAPTURE_KEYS) {
      const value = input.capture[key];
      if (value !== undefined) frontmatter[key] = value;
    }
  }

  const body = input.body ?? "";
  const res = await writeDoc(pagePath(slug), frontmatter, body);
  return toRow(res.path, res.frontmatter as unknown as Record<string, unknown>, body);
}
