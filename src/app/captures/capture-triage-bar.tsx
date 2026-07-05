/**
 * CaptureTriageBar (D33) — the compact triage footer on a rich Inbox card
 * (tweet/video). The card view trades the table's full inline editor for a
 * lighter set of controls: pick an Area (optional), then File to Library, or
 * Discard. Project/quest assignment stays in the table view for power triage.
 */

import { Button } from "@/shared/components/ui/button";
import { AREA_OPTIONS } from "@/shared/lib/areas";
import type { FileDestination, InboxItem } from "@/shared/lib/inbox-data";
import { cn } from "@/shared/lib/utils";
import { ArrowRight, Trash2 } from "lucide-react";
import { useState } from "react";

interface CaptureTriageBarProps {
  item: InboxItem;
  onFile: (item: InboxItem, dest: FileDestination) => void;
  onDiscard: (item: InboxItem) => void;
}

export function CaptureTriageBar({ item, onFile, onDiscard }: CaptureTriageBarProps) {
  const [area, setArea] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
      <div className="mr-auto flex items-center gap-1">
        {AREA_OPTIONS.map((a) => (
          <button
            key={a.slug}
            type="button"
            title={a.label}
            aria-label={a.label}
            onClick={() => setArea(area === a.slug ? null : a.slug)}
            className={cn(
              "flex size-5 items-center justify-center rounded-full transition-transform hover:scale-110",
              area === a.slug && "ring-2 ring-ring ring-offset-1 ring-offset-card",
            )}
          >
            <span className="size-2.5 rounded-full" style={{ backgroundColor: a.color }} />
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onDiscard(item)}
        className="flex items-center gap-1.5 text-caption text-error hover:underline"
      >
        <Trash2 className="size-3.5" />
        Discard
      </button>
      <Button size="sm" onClick={() => onFile(item, { area: area ?? undefined })}>
        File to Library
        <ArrowRight className="size-3.5" />
      </Button>
    </div>
  );
}
