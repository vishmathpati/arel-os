/**
 * TaskStatBand — the overview row at the top of the Task page. Four count cards
 * (Overdue / Today / This week / Done) that answer "what matters now" before you
 * read a row, and double as lens shortcuts. Color is reserved for the two that
 * carry signal: Overdue (error) and Done (success).
 */

import { cn } from "@/shared/lib/utils";
import { CalendarRange, CircleCheck, Sun, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface TaskCounts {
  overdue: number;
  today: number;
  week: number;
  done: number;
}

interface StatCardDef {
  key: keyof TaskCounts;
  label: string;
  icon: LucideIcon;
  accent?: "error" | "success";
}

const CARDS: readonly StatCardDef[] = [
  { key: "overdue", label: "Overdue", icon: TriangleAlert, accent: "error" },
  { key: "today", label: "Today", icon: Sun },
  { key: "week", label: "This week", icon: CalendarRange },
  { key: "done", label: "Done", icon: CircleCheck, accent: "success" },
];

interface TaskStatBandProps {
  counts: TaskCounts;
  onSelect: (key: keyof TaskCounts) => void;
}

export function TaskStatBand({ counts, onSelect }: TaskStatBandProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, accent }) => {
        const accented = accent && counts[key] > 0;
        const tone =
          accent === "error" ? "text-error" : accent === "success" ? "text-success" : undefined;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-hover"
          >
            <span
              className={cn(
                "flex items-center gap-1.5 text-caption text-muted-foreground",
                accented && tone,
              )}
            >
              <Icon className="size-4" />
              {label}
            </span>
            <span className={cn("text-2xl font-semibold tabular-nums", accented && tone)}>
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
