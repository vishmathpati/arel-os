/**
 * QuestRow — one row of the flagship quest table. Aligns via QUEST_GRID. Clicking
 * navigates to the quest detail page. Columns: Quest · Status · Area · Deadline ·
 * Focus. An overdue deadline (past + quest still open) shows red.
 */

import { useAreasContext } from "@/app/areas/areas-provider";
import { formatDue } from "@/app/projects/project-row";
import type { Quest } from "@/shared/lib/quest-data";
import { QUEST_STATUS_META, isQuestFinished } from "@/shared/lib/quests";
import { cn } from "@/shared/lib/utils";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const QUEST_GRID =
  "grid grid-cols-[minmax(0,1fr)_7rem_minmax(0,11rem)_5.5rem_3.5rem] items-center gap-3 px-4";

/** True when the deadline has passed and the quest is still open. */
export function isQuestOverdue(quest: Quest, now: Date = new Date()): boolean {
  if (isQuestFinished(quest.status)) return false;
  const d = new Date(quest.deadline);
  return !Number.isNaN(d.getTime()) && d.getTime() < now.getTime();
}

export function QuestRow({ quest }: { quest: Quest }) {
  const navigate = useNavigate();
  const { labelOf, colorOf } = useAreasContext();
  const meta = QUEST_STATUS_META[quest.status];
  const area = labelOf(quest.area);
  const color = colorOf(quest.area);
  const deadline = formatDue(quest.deadline);
  const overdue = isQuestOverdue(quest);
  const finished = isQuestFinished(quest.status);

  return (
    <button
      type="button"
      onClick={() => navigate(`/quests/${quest.slug}`)}
      className={cn(
        QUEST_GRID,
        "h-11 w-full cursor-pointer border-b border-border/60 text-left transition-colors hover:bg-hover",
      )}
    >
      <span
        className={cn(
          "min-w-0 truncate text-body",
          finished && "text-muted-foreground line-through",
        )}
      >
        {quest.title || "Untitled"}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-caption">
        <span className={cn("size-1.5 shrink-0 rounded-full", meta.dotClass)} />
        <span className={cn("truncate", meta.labelClass ?? "text-muted-foreground")}>
          {meta.label}
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-caption text-muted-foreground">
        {area ? (
          <>
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: color ?? "var(--color-muted-foreground)" }}
            />
            <span className="truncate">{area}</span>
          </>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </span>
      <span className={cn("text-caption text-muted-foreground", overdue && "text-error")}>
        {deadline ?? ""}
      </span>
      <span className="flex items-center">
        {quest.focus && (
          <Star className="size-3.5 fill-warning text-warning" aria-label="This week's focus" />
        )}
      </span>
    </button>
  );
}
