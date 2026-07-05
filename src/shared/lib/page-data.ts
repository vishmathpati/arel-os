/**
 * Page data layer — CRUD over the vault for the Page primitive (D5 / D29).
 * Pages live FLAT in `pages/<slug>.md` (Chapter 2 path scheme); relationships
 * are frontmatter, not folders. Body = the Plate editor's markdown.
 *
 * Subpage model (carried from the old app's children.ts contract, rebuilt):
 * a subpage is a `type: page` doc whose `parent` frontmatter points at its
 * parent (another page, or a block entity like a quest/project/area — "one
 * unified fabric", D29). Creating a subpage also inserts a `[[child-slug]]`
 * wikilink into the parent's body.
 *
 * Browser-only; reads fresh every call (no indexing). Soft-delete only (D12).
 */

import { deleteDoc, listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import { pagePath, slugify } from "@/shared/lib/vault/paths";
import type { PageFrontmatter, VaultDoc } from "@/shared/lib/vault/schemas";

/** An in-memory page: frontmatter flattened, plus path/slug/body. */
export interface Page extends PageFrontmatter {
  /** Relative vault path, e.g. "pages/meeting-notes.md". */
  path: string;
  /** Filename stem. */
  slug: string;
  /** Markdown body = the Plate editor content. */
  body: string;
}

export interface CreatePageInput {
  title: string;
  /** Parent slug (bare) — a page or a block entity; wrapped into a wikilink. */
  parent?: string;
  /** Optional one-home context. */
  area?: string;
  quest?: string;
  project?: string;
  /** Initial markdown body. */
  body?: string;
}

function toPage(doc: VaultDoc<PageFrontmatter>): Page {
  const slug = doc.path.replace(/^pages\//, "").replace(/\.md$/, "");
  return { ...doc.frontmatter, path: doc.path, slug, body: doc.body };
}

/** Strip the in-memory-only fields back to a plain frontmatter object. */
function frontmatterOf(page: Page): Record<string, unknown> {
  const { path: _p, slug: _s, body: _b, ...fm } = page;
  return fm;
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "untitled";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/** Slugs of every file currently in `pages/` (pages + resources share the dir). */
async function takenSlugs(): Promise<Set<string>> {
  const { entries } = await listDir("pages");
  return new Set(
    entries
      .filter((e) => e.type === "file" && e.path.endsWith(".md"))
      .map((e) => e.path.replace(/^pages\//, "").replace(/\.md$/, "")),
  );
}

/** All current (non-deleted) pages, read fresh. Excludes resources. */
export async function listPages(): Promise<Page[]> {
  const { entries } = await listDir("pages");
  const files = entries.filter((e) => e.type === "file" && e.path.endsWith(".md"));
  const docs = await Promise.all(files.map((e) => readDoc(e.path).catch(() => null)));
  return docs
    .filter((d): d is VaultDoc<PageFrontmatter> => d?.frontmatter?.type === "page")
    .filter((d) => !d.frontmatter.deleted)
    .map(toPage);
}

/** Read one page, or null if missing / not a page. */
export async function readPage(slug: string): Promise<Page | null> {
  try {
    const doc = (await readDoc(pagePath(slug))) as VaultDoc<PageFrontmatter>;
    if (doc.frontmatter?.type !== "page") return null;
    return toPage(doc);
  } catch {
    return null;
  }
}

/** Create a page (optionally as a subpage of `parent`). */
export async function createPage(input: CreatePageInput): Promise<Page> {
  const slug = uniqueSlug(slugify(input.title), await takenSlugs());

  const frontmatter: Record<string, unknown> = {
    type: "page",
    title: input.title,
  };
  if (input.parent) frontmatter.parent = toWikilink(input.parent);
  if (input.area) frontmatter.area = toWikilink(input.area);
  if (input.quest) frontmatter.quest = toWikilink(input.quest);
  if (input.project) frontmatter.project = toWikilink(input.project);

  const body = input.body ?? "";
  const res = await writeDoc(pagePath(slug), frontmatter, body);
  return toPage({ path: res.path, frontmatter: res.frontmatter as PageFrontmatter, body });
}

/** Patch a page's frontmatter (and optionally its body). */
export async function updatePage(
  page: Page,
  patch: Partial<PageFrontmatter>,
  body: string = page.body,
): Promise<Page> {
  const frontmatter = { ...frontmatterOf(page), ...patch };
  for (const key of Object.keys(patch) as (keyof PageFrontmatter)[]) {
    if (patch[key] === undefined) delete frontmatter[key];
  }
  const res = await writeDoc(page.path, frontmatter, body);
  return toPage({ path: page.path, frontmatter: res.frontmatter as PageFrontmatter, body });
}

/** Soft-delete a page (moves it to archive/deleted/). */
export async function deletePage(page: Page): Promise<void> {
  await deleteDoc(page.path);
}

/** Pages whose `parent` points at `parentSlug` (its subpages). Pure. */
export function childrenOf(pages: readonly Page[], parentSlug: string): Page[] {
  return pages.filter((p) => p.parent && wikiTarget(p.parent) === parentSlug);
}

/**
 * Append a `[[child]]` wikilink to a parent markdown body if not already
 * present. Returns the new body (or the original when already linked).
 */
export function appendChildLink(body: string, childSlug: string): string {
  const link = `[[${childSlug}]]`;
  if (body.includes(link)) return body;
  const trimmed = body.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n\n${link}\n` : `${link}\n`;
}
