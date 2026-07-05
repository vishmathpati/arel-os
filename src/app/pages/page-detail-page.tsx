/**
 * PageDetailPage — a standalone Page (Chapter 7). Detail chrome (DetailShell)
 * with a Notion-style header: emoji icon + inline title, separated from the
 * PageBody (Plate editor + subpages) by a divider. The markdown body IS the
 * page (D29). Deletion lives in the sidebar Pages tree.
 *
 * Title/icon edits reload the sidebar Pages index so the rename shows without a
 * refresh.
 */

import { DetailShell, InlineTitle } from "@/app/detail/detail-kit";
import { EmojiIconPicker } from "@/app/editor/emoji-icon-picker";
import { PageBody } from "@/app/editor/page-body";
import { usePagesContext } from "@/app/pages/pages-provider";
import { usePage } from "@/app/pages/use-page";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export function PageDetailPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { page, loading, notFound, error, reload, patch, saveBody } = usePage(slug);
  const { reload: reloadPages } = usePagesContext();

  // Only show the skeleton if the (local, usually <50ms) read is slow — avoids a
  // skeleton flash when opening a freshly-created page.
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShowSkeleton(false);
      return;
    }
    const t = setTimeout(() => setShowSkeleton(true), 200);
    return () => clearTimeout(t);
  }, [loading]);

  // Title/icon live in the sidebar too — refresh that index after edits.
  const saveTitle = useCallback(
    async (title: string) => {
      await patch({ title });
      reloadPages();
    },
    [patch, reloadPages],
  );
  const saveIcon = useCallback(
    async (icon: string | undefined, icon_color: string | undefined) => {
      await patch({ icon, icon_color });
      reloadPages();
    },
    [patch, reloadPages],
  );

  if (loading) {
    return (
      <DetailShell crumbs={[{ label: "Pages" }, { label: "Page" }]}>
        {showSkeleton && (
          <>
            <Skeleton className="h-9 w-64" />
            <Skeleton className="mt-6 h-40 w-full max-w-2xl rounded-lg" />
          </>
        )}
      </DetailShell>
    );
  }

  if (notFound || !page) {
    return (
      <DetailShell crumbs={[{ label: "Pages" }, { label: "Page" }]}>
        <Alert>
          <AlertTitle>Page not found</AlertTitle>
          <AlertDescription>
            This page doesn’t exist or was archived.{" "}
            <button type="button" className="underline" onClick={() => navigate("/")}>
              Go home
            </button>
            .
          </AlertDescription>
        </Alert>
      </DetailShell>
    );
  }

  const inheritArea = page.area ? wikiTarget(page.area) : undefined;

  return (
    <DetailShell crumbs={[{ label: "Pages" }, { label: page.title || "Untitled" }]}>
      {/* Header: emoji icon + title, divided from the body */}
      <div className="-mx-1 flex items-center gap-1 border-border border-b pb-3">
        <EmojiIconPicker value={page.icon} color={page.icon_color} onSelect={saveIcon} />
        <InlineTitle value={page.title ?? ""} onSave={saveTitle} />
      </div>

      <div className="mt-4">
        <PageBody
          parentSlug={page.slug}
          body={page.body}
          onSaveBody={saveBody}
          inheritArea={inheritArea}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={reload}>
            Retry
          </Button>
        </Alert>
      )}
    </DetailShell>
  );
}
