/**
 * detail-kit — the shared primitives of the locked block-detail sub-template
 * (D28). Project, Quest, Page, and Area detail pages compose from these so
 * "copies the sub-template" is literal, not duplicated. Header controls use the
 * same pill styles; the body is the shared `PageBody` (Plate editor + subpages,
 * Ch7/D29) — the placeholder Notes textarea was retired when Plate landed.
 */

import { type Crumb, PageHeader } from "@/app/page-header";
import { useState } from "react";

export const PILL_BASE =
  "rounded-md px-2.5 py-1 text-caption transition-colors border border-transparent";
export const PILL_OFF =
  "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground";
export const PILL_ON = "border-transparent bg-accent text-accent-foreground";

/** Page shell: breadcrumb header + centered, width-capped body (flagship chrome).
 * `fullWidth` removes the width cap (edge-to-edge), used by databases (Ch8 v3). */
export function DetailShell({
  crumbs,
  children,
  fullWidth,
}: {
  crumbs: Crumb[];
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader crumbs={crumbs} />
      <div className="flex-1 overflow-y-auto">
        <div className={fullWidth ? "px-6 py-6" : "mx-auto max-w-[1280px] px-6 py-6"}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** A labeled control row (16-rem label gutter + wrapping controls). */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 pt-1.5 text-caption text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Click-to-edit heading-size title. Enter/blur saves; Esc cancels. Uses a plain
 * input (not the shadcn Input) so the editing and display states render at the
 * exact same size — the shadcn Input's built-in `text-base/sm` otherwise shrinks
 * the title while editing.
 */
const TITLE_CLASS = "block w-full max-w-full text-heading font-semibold leading-tight";

export function InlineTitle({ value, onSave }: { value: string; onSave: (next: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: focus the title the moment editing starts
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const t = draft.trim();
          if (t && t !== value) onSave(t);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`${TITLE_CLASS} border-0 bg-transparent p-0 outline-none`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className={`${TITLE_CLASS} cursor-text text-left`}
    >
      {value || <span className="text-muted-foreground/50">Untitled</span>}
    </button>
  );
}
