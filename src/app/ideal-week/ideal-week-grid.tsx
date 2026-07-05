/**
 * Ideal Week grid (Ch14 / D40) — the bespoke time-blocking surface (the one
 * approved non-shadcn primitive). A left time gutter + 7 day columns (Mon–Sun),
 * each a relative track whose height comes from the persisted window
 * (`dayStart`–`dayEnd`); blocks are absolutely positioned by their start/end
 * minutes.
 *
 * Interaction (Google-Calendar-style):
 *  - Hover an empty area → a faint ghost of the 1-hour block a click would make.
 *  - Click (no drag) → create a default 1-hour block at the snapped slot.
 *  - Drag → create a block spanning the dragged range, live-previewed. 15-min snap.
 *  - Resize → top/bottom handles on each block change start/end (15-min snap),
 *    live-previewed, persisted on release. Drag-to-MOVE is deferred (D40).
 *
 * The add-surface is a pointer-handled <div> (drag needs raw mousedown/move/up,
 * which a <button> can't carry cleanly). Keyboard users add via the page header's
 * "Add block" button; the surface is aria-hidden so it never traps focus.
 */

import {
  DAY_SHORT,
  DEFAULT_DAY_END,
  DEFAULT_DAY_START,
  IDEAL_WEEK_DAYS,
  categoryAccent,
  categoryFill,
  snapMinutes,
  timeToMinutes,
} from "@/shared/lib/ideal-week";
import { cn } from "@/shared/lib/utils";
import type { IdealWeekBlock, WeekDay } from "@/shared/lib/vault/schemas";
import { useRef, useState } from "react";

const PX_PER_HOUR = 56;
const SNAP = 15;
const DEFAULT_DURATION = 60;
const MIN_DURATION = 15;

const fmt = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const formatHour = (h: number): string =>
  h === 12 ? "12 PM" : h === 24 || h === 0 ? "12 AM" : h > 12 ? `${h - 12} PM` : `${h} AM`;
const formatTime = (hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 && h < 24 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

/** A live drag — either creating a new block or resizing an existing one. */
type DragState =
  | { mode: "create"; day: WeekDay; anchorMin: number; startMin: number; endMin: number }
  | {
      mode: "resize";
      id: string;
      edge: "top" | "bottom";
      day: WeekDay;
      startMin: number;
      endMin: number;
    };

interface IdealWeekGridProps {
  blocks: IdealWeekBlock[];
  dayStart?: string;
  dayEnd?: string;
  onAddAt: (day: WeekDay, start: string, end: string) => void;
  onEditBlock: (block: IdealWeekBlock) => void;
  onResizeBlock: (id: string, start: string, end: string) => void;
}

export function IdealWeekGrid({
  blocks,
  dayStart = DEFAULT_DAY_START,
  dayEnd = DEFAULT_DAY_END,
  onAddAt,
  onEditBlock,
  onResizeBlock,
}: IdealWeekGridProps) {
  const rangeMin = timeToMinutes(dayStart);
  const endMin = timeToMinutes(dayEnd);
  const gridHeight = ((endMin - rangeMin) / 60) * PX_PER_HOUR;
  const startHour = Math.floor(rangeMin / 60);
  const endHour = Math.ceil(endMin / 60);
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i).filter(
    (h) => h * 60 >= rangeMin && h * 60 <= endMin,
  );

  const minuteToY = (min: number): number => ((min - rangeMin) / 60) * PX_PER_HOUR;
  /** Pointer Y (px, relative to a column) → snapped minute, clamped to window. */
  const yToMin = (y: number): number => {
    const raw = rangeMin + (y / PX_PER_HOUR) * 60;
    return Math.max(rangeMin, Math.min(endMin, snapMinutes(raw, SNAP)));
  };

  const [hover, setHover] = useState<{ day: WeekDay; min: number } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Set when a resize just released, so the trailing synthetic click on the
  // block doesn't open the edit dialog. Cleared on the next genuine block click.
  const suppressClickRef = useRef(false);

  // ── Create (drag or click on the empty surface) ──────────────────────────
  const beginCreate = (day: WeekDay, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const downY = e.clientY - rect.top;
    const anchorMin = yToMin(downY);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    setHover(null);
    setDrag({ mode: "create", day, anchorMin, startMin: anchorMin, endMin: anchorMin });

    const onMove = (ev: PointerEvent) => {
      const y = ev.clientY - rect.top;
      const cur = yToMin(y);
      const lo = Math.min(anchorMin, cur);
      const hi = Math.max(anchorMin, cur);
      setDrag({ mode: "create", day, anchorMin, startMin: lo, endMin: hi });
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const y = ev.clientY - rect.top;
      const cur = yToMin(y);
      let lo = Math.min(anchorMin, cur);
      let hi = Math.max(anchorMin, cur);
      if (hi - lo < MIN_DURATION) {
        // A click (or a drag too small to matter) → a default 1-hour block.
        lo = Math.min(anchorMin, endMin - DEFAULT_DURATION);
        hi = Math.min(endMin, lo + DEFAULT_DURATION);
      }
      setDrag(null);
      onAddAt(day, fmt(lo), fmt(hi));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // ── Resize (top/bottom handle on a block) ────────────────────────────────
  const beginResize = (
    block: IdealWeekBlock,
    edge: "top" | "bottom",
    e: React.PointerEvent<HTMLElement>,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const column = e.currentTarget.closest("[data-day-column]") as HTMLElement | null;
    if (!column) return;
    const rect = column.getBoundingClientRect();
    const startMin = timeToMinutes(block.start);
    const endBlockMin = timeToMinutes(block.end);
    setHover(null);
    setDrag({ mode: "resize", id: block.id, edge, day: block.day, startMin, endMin: endBlockMin });

    const onMove = (ev: PointerEvent) => {
      const cur = yToMin(ev.clientY - rect.top);
      if (edge === "top") {
        const top = Math.min(cur, endBlockMin - MIN_DURATION);
        setDrag({
          mode: "resize",
          id: block.id,
          edge,
          day: block.day,
          startMin: top,
          endMin: endBlockMin,
        });
      } else {
        const bottom = Math.max(cur, startMin + MIN_DURATION);
        setDrag({ mode: "resize", id: block.id, edge, day: block.day, startMin, endMin: bottom });
      }
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const cur = yToMin(ev.clientY - rect.top);
      const finalStart = edge === "top" ? Math.min(cur, endBlockMin - MIN_DURATION) : startMin;
      const finalEnd = edge === "bottom" ? Math.max(cur, startMin + MIN_DURATION) : endBlockMin;
      setDrag(null);
      // Swallow the trailing click that the browser fires on the block button.
      suppressClickRef.current = true;
      if (finalStart !== startMin || finalEnd !== endBlockMin) {
        onResizeBlock(block.id, fmt(finalStart), fmt(finalEnd));
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <div className="min-w-[56rem]">
        {/* Header — day names */}
        <div className="flex border-border border-b">
          <div className="w-14 shrink-0" />
          {IDEAL_WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="flex-1 border-border border-l py-2 text-center text-caption font-medium text-muted-foreground"
            >
              {DAY_SHORT[day]}
            </div>
          ))}
        </div>

        {/* Body — time gutter + day tracks */}
        <div className="flex">
          {/* Time gutter */}
          <div className="relative w-14 shrink-0" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div
                key={h}
                className="-translate-y-1/2 absolute right-2 text-[10px] text-muted-foreground/70 tabular-nums"
                style={{ top: minuteToY(h * 60) }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {IDEAL_WEEK_DAYS.map((day) => {
            const dayBlocks = blocks.filter((b) => b.day === day);
            const creatingHere =
              drag?.mode === "create" && drag.day === day && drag.endMin - drag.startMin > 0;
            return (
              <div
                key={day}
                data-day-column
                className="relative flex-1 overflow-hidden border-border border-l"
                style={{ height: gridHeight }}
              >
                {/* Pointer-driven add surface (behind the blocks). Keyboard users
                    add via the page header's "Add block" button. */}
                <div
                  aria-hidden="true"
                  onPointerDown={(e) => beginCreate(day, e)}
                  onPointerMove={(e) => {
                    if (drag) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHover({ day, min: yToMin(e.clientY - rect.top) });
                  }}
                  onPointerLeave={() => setHover((h) => (h?.day === day ? null : h))}
                  className="absolute inset-0 cursor-copy touch-none"
                />
                {/* Hour gridlines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-border/40 border-t"
                    style={{ top: minuteToY(h * 60) }}
                  />
                ))}

                {/* Hover ghost — what a click would create (1h) */}
                {!drag && hover?.day === day && (
                  <GhostBlock
                    top={minuteToY(Math.min(hover.min, endMin - DEFAULT_DURATION))}
                    height={
                      minuteToY(
                        Math.min(
                          endMin,
                          Math.min(hover.min, endMin - DEFAULT_DURATION) + DEFAULT_DURATION,
                        ),
                      ) - minuteToY(Math.min(hover.min, endMin - DEFAULT_DURATION))
                    }
                    faint
                  />
                )}

                {/* Live drag-create preview */}
                {creatingHere && drag.mode === "create" && (
                  <GhostBlock
                    top={minuteToY(drag.startMin)}
                    height={minuteToY(drag.endMin) - minuteToY(drag.startMin)}
                    label={`${formatTime(fmt(drag.startMin))} – ${formatTime(fmt(drag.endMin))}`}
                  />
                )}

                {/* Blocks (on top of the add-surface) */}
                {dayBlocks.map((b) => {
                  const live =
                    drag?.mode === "resize" && drag.id === b.id
                      ? { start: fmt(drag.startMin), end: fmt(drag.endMin) }
                      : null;
                  return (
                    <BlockCard
                      key={b.id}
                      block={b}
                      previewStart={live?.start}
                      previewEnd={live?.end}
                      minuteToY={minuteToY}
                      onEdit={() => {
                        if (suppressClickRef.current) {
                          suppressClickRef.current = false;
                          return;
                        }
                        onEditBlock(b);
                      }}
                      onResizeStart={(edge, e) => beginResize(b, edge, e)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GhostBlock({
  top,
  height,
  label,
  faint,
}: {
  top: number;
  height: number;
  label?: string;
  faint?: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-1 z-10 overflow-hidden rounded-md border border-primary/40 border-dashed bg-accent px-2 text-foreground",
        faint ? "opacity-40" : "opacity-80",
      )}
      style={{ top, height: Math.max(height, 18) }}
    >
      {label && (
        <div className="truncate pt-1 text-[10px] text-muted-foreground tabular-nums">{label}</div>
      )}
    </div>
  );
}

function BlockCard({
  block,
  previewStart,
  previewEnd,
  minuteToY,
  onEdit,
  onResizeStart,
}: {
  block: IdealWeekBlock;
  previewStart?: string;
  previewEnd?: string;
  minuteToY: (min: number) => number;
  onEdit: () => void;
  onResizeStart: (edge: "top" | "bottom", e: React.PointerEvent<HTMLElement>) => void;
}) {
  const start = previewStart ?? block.start;
  const end = previewEnd ?? block.end;
  const top = minuteToY(timeToMinutes(start));
  const height = Math.max(18, minuteToY(timeToMinutes(end)) - top);
  const compact = height < 38;

  return (
    <button
      type="button"
      onClick={onEdit}
      className="group absolute inset-x-1 cursor-pointer overflow-hidden rounded-md pl-2 pr-1.5 text-left text-foreground"
      style={{
        top,
        height,
        backgroundColor: categoryFill(block.category),
        borderLeft: `3px solid ${categoryAccent(block.category)}`,
      }}
    >
      {/* Resize handles — siblings inside the button; pointer-down captures the
          drag and stops the click, so they never trigger edit. */}
      <span
        aria-hidden="true"
        onPointerDown={(e) => onResizeStart("top", e)}
        className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
      />
      <div
        className={cn("truncate font-medium", compact ? "text-[10px] leading-4" : "text-caption")}
      >
        {block.label}
      </div>
      {!compact && (
        <div className="truncate text-[10px] text-muted-foreground tabular-nums">
          {formatTime(start)} – {formatTime(end)}
        </div>
      )}
      <span
        aria-hidden="true"
        onPointerDown={(e) => onResizeStart("bottom", e)}
        className="absolute inset-x-0 bottom-0 z-10 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
      />
    </button>
  );
}
