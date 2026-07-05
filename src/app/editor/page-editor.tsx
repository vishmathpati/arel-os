/**
 * PageEditor — THE Plate editor (Chapter 7, built once per D29). Composed from
 * the essential Plate registry kits (official patterns only): basic nodes +
 * marks, lists, code block, slash menu, wikilinks (`[[page]]`), and the markdown
 * round-trip. Reused by standalone Pages AND the Area/Quest/Project detail
 * bodies — the markdown body IS the page body.
 *
 * Layout: a clean, full-width writing surface — no inner scrollbar (the page
 * scrolls), no width cap, top-aligned body-size placeholder.
 *
 * Autosave is silent, debounced 800ms (DESIGN.md §554), plus explicit Cmd+S.
 * Serialize compares against the last-saved markdown so selection-only changes
 * never write; flushes on unmount so navigating away persists.
 *
 * Subpages are created from the slash menu (`/subpage`). PageEditor exposes the
 * create + open callbacks to the slash command via `editor.meta`.
 */

import { EditorKit } from "@/shared/components/editor/editor-kit";
import type { PageEditorMeta } from "@/shared/components/editor/page-editor-meta";
import { Editor, EditorContainer } from "@/shared/components/ui/editor";
import { MarkdownPlugin } from "@platejs/markdown";
import type { Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";
import { useCallback, useEffect, useRef } from "react";

const EMPTY_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

export interface PageEditorProps {
  /** The page's markdown body. */
  value: string;
  /** Persist the serialized markdown body (silent autosave + Cmd+S). */
  onSave: (markdown: string) => void;
  placeholder?: string;
  /** Create an Untitled subpage under this entity (slash `/subpage`). */
  onCreateSubpage?: () => Promise<{ slug: string; title: string } | null>;
  /** Open a page by slug (after creating a subpage). */
  onOpenPage?: (slug: string) => void;
}

export function PageEditor({
  value,
  onSave,
  placeholder,
  onCreateSubpage,
  onOpenPage,
}: PageEditorProps) {
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: (editor) => {
      const parsed = editor.getApi(MarkdownPlugin).markdown.deserialize(value ?? "");
      return parsed.length > 0 ? parsed : EMPTY_VALUE;
    },
  });

  // Expose subpage actions to the slash command (read in slash-node).
  const meta = editor.meta as PageEditorMeta;
  meta.createSubpage = onCreateSubpage;
  meta.openPage = onOpenPage;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(value ?? "");

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const markdown = editor.getApi(MarkdownPlugin).markdown.serialize();
    if (markdown !== lastSaved.current) {
      lastSaved.current = markdown;
      onSave(markdown);
    }
  }, [editor, onSave]);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
  }, [flush]);

  // Flush any pending edit when the editor unmounts (e.g. navigating away).
  useEffect(() => () => flush(), [flush]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flush();
      }
    },
    [flush],
  );

  return (
    <Plate editor={editor} onChange={scheduleSave}>
      <EditorContainer
        variant="default"
        className="h-auto w-full overflow-visible overflow-y-visible"
        onKeyDown={onKeyDown}
      >
        <Editor
          variant="none"
          className={[
            "w-full px-0 pt-1 pb-40 text-[16px] leading-[1.7]",
            // Top-align the placeholder at body size (override the registry's
            // vertically-centered, oversized empty-state placeholder).
            "**:data-slate-placeholder:top-0! **:data-slate-placeholder:translate-y-0!",
            "**:data-slate-placeholder:text-[16px]! **:data-slate-placeholder:font-normal!",
          ].join(" ")}
          placeholder={placeholder ?? "Write something, or press / for blocks…"}
        />
      </EditorContainer>
    </Plate>
  );
}
