"use client";

/**
 * MarkdownView — a read-only Plate render of a protocol file's markdown for the
 * Files tab (project-sync v2). Reuses the app's EditorKit (the same node set the
 * Notes editor uses) so a project's STATUS/BRIEF/etc. render with the app's own
 * typography instead of raw source. `readOnly` suppresses the editing chrome
 * (slash, toolbar, DnD); the parent keys this by file path so a new selection
 * re-deserializes (the Plate value is set once at init).
 */

import { EditorKit } from "@/shared/components/editor/editor-kit";
import { Editor } from "@/shared/components/ui/editor";
import { MarkdownPlugin } from "@platejs/markdown";
import type { Value } from "platejs";
import { Plate, usePlateEditor } from "platejs/react";

const EMPTY_VALUE: Value = [{ type: "p", children: [{ text: "" }] }];

export function MarkdownView({ markdown }: { markdown: string }) {
  const editor = usePlateEditor({
    plugins: EditorKit,
    value: (editor) => {
      const parsed = editor.getApi(MarkdownPlugin).markdown.deserialize(markdown ?? "");
      return parsed.length > 0 ? parsed : EMPTY_VALUE;
    },
  });

  return (
    <Plate editor={editor}>
      <Editor
        readOnly
        variant="none"
        className="w-full px-4 py-3 text-[16px] leading-[1.7] [&_pre]:whitespace-pre-wrap [&_pre]:break-words"
      />
    </Plate>
  );
}
