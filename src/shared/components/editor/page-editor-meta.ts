/**
 * Per-editor metadata bridged to the slash command (Chapter 7). Subpage creation
 * needs the parent entity's slug + the app's page-create/navigate functions,
 * which are app concerns; the slash menu (shared) reads them off `editor.meta`.
 */

export interface PageEditorMeta {
  /** Create an Untitled subpage under the current entity; returns it. */
  createSubpage?: () => Promise<{ slug: string; title: string } | null>;
  /** Navigate to a page by slug. */
  openPage?: (slug: string) => void;
  [key: string]: unknown;
}
