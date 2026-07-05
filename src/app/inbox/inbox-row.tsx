/**
 * InboxRow — one row of the inbox table (Chapter 9, D32). Mirrors the flagship
 * TaskRow: a quiet row whose click expands it inline into the triage editor —
 * no side panel. Columns: kind icon · title · type · captured-when.
 */

import { InboxTriageEditor } from "@/app/inbox/inbox-triage-editor";
import type { TaskLinkOption, TaskProjectOption } from "@/app/tasks/task-inline-editor";
import type { FileDestination, InboxItem } from "@/shared/lib/inbox-data";
import { cn } from "@/shared/lib/utils";
import type { InboxFrontmatter, ResourceKind } from "@/shared/lib/vault/schemas";
import {
  FileText,
  Image,
  Link2,
  ListTodo,
  type LucideIcon,
  MessageCircle,
  Video,
} from "lucide-react";
import { Fragment } from "react";

/** Shared column grid — used by every row AND the table's column header. */
export const INBOX_GRID =
  "grid grid-cols-[1.25rem_minmax(0,1fr)_7rem_6rem] items-center gap-3 px-4";

const RESOURCE_ICON: Record<ResourceKind, LucideIcon> = {
  link: Link2,
  tweet: MessageCircle,
  video: Video,
  image: Image,
  note: Link2,
  article: FileText,
};

interface InboxRowProps {
  item: InboxItem;
  expanded: boolean;
  onToggleExpand: (item: InboxItem) => void;
  onPatch: (item: InboxItem, patch: Partial<InboxFrontmatter>) => void;
  onFile: (item: InboxItem, dest: FileDestination) => void;
  onDiscard: (item: InboxItem) => void;
  projectOptions?: TaskProjectOption[];
  questOptions?: TaskLinkOption[];
}

/** "captured" day label from the ISO `created` stamp. */
function capturedLabel(created: string | undefined, now: Date): string {
  if (!created) return "";
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return "";
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InboxRow({
  item,
  expanded,
  onToggleExpand,
  onPatch,
  onFile,
  onDiscard,
  projectOptions,
  questOptions,
}: InboxRowProps) {
  const Icon = item.kind === "resource" ? RESOURCE_ICON[item.resource_kind ?? "link"] : ListTodo;
  const typeLabel = item.kind === "resource" ? (item.resource_kind ?? "link") : "Task";

  return (
    <Fragment>
      <button
        type="button"
        onClick={() => onToggleExpand(item)}
        className={cn(
          INBOX_GRID,
          "h-11 w-full cursor-pointer border-b border-border/60 text-left transition-colors hover:bg-hover",
          expanded && "bg-hover",
        )}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate text-body">{item.title || item.url || "Untitled"}</span>
        <span className="truncate text-caption text-muted-foreground capitalize">{typeLabel}</span>
        <span className="text-caption text-muted-foreground">
          {capturedLabel(item.created, new Date())}
        </span>
      </button>

      {expanded && (
        <InboxTriageEditor
          item={item}
          onPatch={onPatch}
          onFile={onFile}
          onDiscard={onDiscard}
          projectOptions={projectOptions}
          questOptions={questOptions}
        />
      )}
    </Fragment>
  );
}
