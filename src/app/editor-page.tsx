import { Editor, EditorContainer } from "@/shared/components/ui/editor";
import { Plate } from "platejs/react";
import { createPlateEditor } from "platejs/react";
import { useMemo } from "react";

export function EditorPage() {
  const editor = useMemo(
    () =>
      createPlateEditor({
        value: [
          {
            type: "p",
            children: [{ text: "Start writing here…" }],
          },
        ],
      }),
    [],
  );

  return (
    <div className="flex flex-1 flex-col overflow-auto px-8 py-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Untitled</h1>
      <div className="flex-1 rounded-lg border border-border bg-card">
        <Plate editor={editor}>
          <EditorContainer>
            <Editor placeholder="Type something…" />
          </EditorContainer>
        </Plate>
      </div>
    </div>
  );
}
