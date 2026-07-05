/**
 * Heatmap — GitHub-contributions-style grid of squares.
 *
 * Design contract:
 * - CSS grid of rounded squares (no SVG, no canvas, no custom chart lib).
 * - Single color (success token) at opacity steps: empty / 40% / 70% / 100%.
 * - shadcn Tooltip on each day (date + done/missed + value for quantity habits).
 * - clickable: onClick(date) is called when a non-future day is clicked.
 * - No new design tokens. Uses --color-success from the existing palette.
 *
 * Used by:
 * - HabitCard (mini version: 12 weeks)
 * - HabitDetailPage (full year: 52 weeks)
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { HeatmapDay } from "@/shared/lib/habits/habits";
import { cn } from "@/shared/lib/utils";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Month labels: show month abbr at the start of the first week of that month.
function monthLabel(weeks: HeatmapDay[][], weekIdx: number): string | null {
  const week = weeks[weekIdx];
  // Sunday of the week
  const firstDay = week[0];
  const date = new Date(`${firstDay.date}T00:00:00`);
  // Show month name at the start of each month (or first week)
  if (date.getDate() <= 7 || weekIdx === 0) {
    return date.toLocaleDateString("en-US", { month: "short" });
  }
  return null;
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface HeatmapProps {
  weeks: HeatmapDay[][];
  isQuantity?: boolean;
  target?: number;
  unit?: string;
  onClick?: (date: string) => void;
  /** If true, hide day-of-week labels (for the mini card variant). */
  compact?: boolean;
}

export function Heatmap({ weeks, isQuantity, target, unit, onClick, compact }: HeatmapProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex gap-[3px]">
        {/* Day-of-week label column */}
        {!compact && (
          <div className="flex flex-col gap-[3px] pr-1">
            {/* Spacer for month-label row */}
            <div className="h-4" />
            {DAY_LABELS.map((l, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: day-of-week labels are stable
              <div key={i} className="flex h-[11px] w-3 items-center justify-end">
                {/* Show every other label to avoid crowding (Mon, Wed, Fri) */}
                {i % 2 !== 0 && (
                  <span className="text-[9px] leading-none text-muted-foreground">{l}</span>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Week columns */}
        {weeks.map((week, wi) => {
          const label = compact ? null : monthLabel(weeks, wi);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: week index is positionally stable
            <div key={wi} className="flex flex-col gap-[3px]">
              {/* Month label row */}
              {!compact && (
                <div className="h-4 flex items-end">
                  {label ? (
                    <span className="text-[9px] leading-none text-muted-foreground whitespace-nowrap">
                      {label}
                    </span>
                  ) : null}
                </div>
              )}
              {week.map((day) => {
                const intensity = getDayIntensity(day, isQuantity, target);
                return (
                  <Tooltip key={day.date}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        disabled={day.future}
                        onClick={() => !day.future && onClick?.(day.date)}
                        className={cn(
                          "rounded-sm transition-opacity",
                          compact ? "size-[9px]" : "size-[11px]",
                          day.future
                            ? "cursor-default bg-muted/30"
                            : "cursor-pointer hover:opacity-80",
                          intensity === 0 && !day.future && "bg-muted/50",
                          intensity === 1 && "bg-success/40",
                          intensity === 2 && "bg-success/70",
                          intensity === 3 && "bg-success",
                        )}
                        aria-label={day.date}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-caption">
                      <p className="font-medium">{formatDate(day.date)}</p>
                      {day.future ? (
                        <p className="text-muted-foreground">Future</p>
                      ) : day.completed ? (
                        <p className="text-success">
                          {isQuantity && day.value !== undefined
                            ? `${day.value}${unit ? ` ${unit}` : ""} done`
                            : "Done"}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">Missed</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/** Returns 0 (none), 1 (low), 2 (mid), 3 (full) intensity for a day. */
function getDayIntensity(day: HeatmapDay, isQuantity?: boolean, target?: number): 0 | 1 | 2 | 3 {
  if (!day.completed) return 0;
  if (!isQuantity || target === undefined || day.value === undefined) return 3;
  const ratio = day.value / target;
  if (ratio >= 1) return 3;
  if (ratio >= 0.7) return 2;
  if (ratio >= 0.4) return 1;
  return 0;
}
