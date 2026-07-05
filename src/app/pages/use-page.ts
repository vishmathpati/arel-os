/**
 * usePage — loads one standalone page for the editor route and exposes its
 * mutations (title/frontmatter patch, body save, delete). Mirrors useProject:
 * confirmed writes update local state; failures toast.
 */

import { type Page, deletePage, readPage, updatePage } from "@/shared/lib/page-data";
import type { PageFrontmatter } from "@/shared/lib/vault/schemas";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

export interface UsePage {
  page: Page | null;
  loading: boolean;
  notFound: boolean;
  error: string | null;
  reload: () => void;
  patch: (patch: Partial<PageFrontmatter>) => Promise<void>;
  saveBody: (body: string) => Promise<void>;
  remove: () => Promise<boolean>;
}

const errMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Something went wrong";

export function usePage(slug: string): UsePage {
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    readPage(slug)
      .then((p) => {
        if (!p) setNotFound(true);
        setPage(p);
      })
      .catch((err) => setError(errMessage(err)))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => reload(), [reload]);

  const patch = useCallback(
    async (p: Partial<PageFrontmatter>) => {
      if (!page) return;
      try {
        setPage(await updatePage(page, p));
      } catch (err) {
        toast.error(`Couldn't save: ${errMessage(err)}`);
      }
    },
    [page],
  );

  const saveBody = useCallback(
    async (body: string) => {
      if (!page || body === page.body) return;
      try {
        setPage(await updatePage(page, {}, body));
      } catch (err) {
        toast.error(`Couldn't save: ${errMessage(err)}`);
      }
    },
    [page],
  );

  const remove = useCallback(async () => {
    if (!page) return false;
    try {
      await deletePage(page);
      toast.success("Page moved to archive");
      return true;
    } catch (err) {
      toast.error(`Couldn't delete: ${errMessage(err)}`);
      return false;
    }
  }, [page]);

  return { page, loading, notFound, error, reload, patch, saveBody, remove };
}
