/**
 * usePages — the whole-vault page list, read fresh. Feeds the sidebar Pages tree
 * AND the wikilink `[[` autocomplete index (one source, no duplicate reads).
 * `create` makes a new page (optionally a subpage) and reloads.
 */

import {
  type CreatePageInput,
  type Page,
  createPage,
  deletePage,
  listPages,
  updatePage,
} from "@/shared/lib/page-data";
import { toWikilink } from "@/shared/lib/vault/frontmatter";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UsePages {
  pages: Page[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  create: (input: CreatePageInput) => Promise<Page | null>;
  /** Move a page under a new parent (slug), or to the top level (null). */
  reparent: (page: Page, parentSlug: string | null) => Promise<void>;
  /** Soft-delete a page. */
  remove: (page: Page) => Promise<void>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function usePages(): UsePages {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listPages()
      .then(setPages)
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  const create = useCallback(
    async (input: CreatePageInput) => {
      try {
        const page = await createPage(input);
        reload();
        return page;
      } catch (err) {
        toast.error(`Couldn't create page: ${errMessage(err)}`);
        return null;
      }
    },
    [reload],
  );

  const reparent = useCallback(
    async (page: Page, parentSlug: string | null) => {
      // No-op if unchanged or trying to nest under itself.
      if (parentSlug === page.slug) return;
      const current = page.parent ?? null;
      const next = parentSlug ? toWikilink(parentSlug) : undefined;
      if ((current ?? null) === (next ?? null)) return;
      try {
        await updatePage(page, { parent: next });
        reload();
      } catch (err) {
        toast.error(`Couldn't move page: ${errMessage(err)}`);
      }
    },
    [reload],
  );

  const remove = useCallback(
    async (page: Page) => {
      try {
        await deletePage(page);
        toast.success("Page moved to archive");
        reload();
      } catch (err) {
        toast.error(`Couldn't delete: ${errMessage(err)}`);
      }
    },
    [reload],
  );

  return { pages, loading, error, reload, create, reparent, remove };
}
