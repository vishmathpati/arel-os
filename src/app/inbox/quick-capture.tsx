/**
 * QuickCapture — the floating ⌘N capture (Chapter 9, D32). One field: type and
 * Enter. Kind is auto-detected and shown as a quiet hint, never a toggle — the
 * real task/resource decision happens later, in triage. Captures and closes;
 * Esc dismisses. Rendered globally by the InboxProvider.
 */

import { Dialog, DialogContent, DialogTitle } from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { detectCapture } from "@/shared/lib/inbox-data";
import type { InboxItem } from "@/shared/lib/inbox-data";
import { cn } from "@/shared/lib/utils";
import { FileText, Image, Link2, ListTodo, MessageCircle, Video } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface QuickCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (raw: string) => Promise<InboxItem | null>;
}

const RESOURCE_ICON = {
  link: Link2,
  tweet: MessageCircle,
  video: Video,
  image: Image,
  note: Link2,
  article: FileText,
} as const;

export function QuickCapture({ open, onOpenChange, onCapture }: QuickCaptureProps) {
  const [value, setValue] = useState("");
  const text = value.trim();
  const detection = text ? detectCapture(text) : null;

  const submit = async () => {
    if (!text) return;
    setValue("");
    const item = await onCapture(text);
    if (item) toast.success("Added to Inbox");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setValue("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Quick capture</DialogTitle>
        <div className="flex items-center gap-3 px-4">
          <ListTodo className="size-4 shrink-0 text-muted-foreground" />
          {/* biome-ignore lint/a11y/noAutofocus: a capture box exists to be typed in immediately. */}
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Capture a thought, task, or link…"
            className="h-14 border-0 bg-transparent px-0 text-body shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>

        <div className="flex h-9 items-center justify-between border-t border-border px-4 text-caption text-muted-foreground">
          <DetectionHint detection={detection} />
          <span className="flex items-center gap-2">
            <Kbd>Enter</Kbd>
            <span>to capture</span>
            <span className="text-muted-foreground/40">·</span>
            <Kbd>Esc</Kbd>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetectionHint({ detection }: { detection: ReturnType<typeof detectCapture> | null }) {
  if (!detection) {
    return <span className="text-muted-foreground/60">Type and press Enter</span>;
  }
  if (detection.kind === "task") {
    return (
      <span className="flex items-center gap-1.5">
        <ListTodo className="size-3.5" />
        <span>Task</span>
      </span>
    );
  }
  const kind = detection.resource_kind ?? "link";
  const Icon = RESOURCE_ICON[kind];
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="size-3.5" />
      <span className="capitalize">{kind}</span>
      {detection.source && <span className="text-muted-foreground/60">· {detection.source}</span>}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border",
        "bg-muted px-1 font-mono text-[0.65rem] text-muted-foreground",
      )}
    >
      {children}
    </kbd>
  );
}
