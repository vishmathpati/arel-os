"use client";

/**
 * PageBody — the reusable page body (Chapter 7, D29): the full-width Plate editor
 * over the entity's markdown body. Reused by standalone Pages AND the
 * Area/Quest/Project detail bodies, so the editing experience is identical.
 *
 * Subpages are created from the slash menu (`/subpage`): it makes a `type: page`
 * doc with `parent` = this entity's slug, inserts a `[[child]]` wikilink at the
 * cursor, and opens the new page. There is no separate "add subpage" affordance.
 */

import { PageEditor } from "@/app/editor/page-editor";
import { usePagesContext } from "@/app/pages/pages-provider";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export interface PageBodyProps {
  /** The entity whose subpages are `parent === parentSlug` (page/quest/project/area). */
  parentSlug: string;
  /** The entity's markdown body (the editor content). */
  body: string;
  /** Persist the edited markdown body. */
  onSaveBody: (markdown: string) => void;
  /** Area slug new subpages inherit, if any. */
  inheritArea?: string;
  placeholder?: string;
}

export function PageBody({
  parentSlug,
  body,
  onSaveBody,
  inheritArea,
  placeholder,
}: PageBodyProps) {
  const { create } = usePagesContext();
  const navigate = useNavigate();

  const onCreateSubpage = useCallback(async () => {
    const child = await create({ title: "Untitled", parent: parentSlug, area: inheritArea });
    return child ? { slug: child.slug, title: child.title || child.slug } : null;
  }, [create, parentSlug, inheritArea]);

  const onOpenPage = useCallback((slug: string) => navigate(`/pages/${slug}`), [navigate]);

  return (
    <PageEditor
      key={parentSlug}
      value={body}
      onSave={onSaveBody}
      placeholder={placeholder}
      onCreateSubpage={onCreateSubpage}
      onOpenPage={onOpenPage}
    />
  );
}
