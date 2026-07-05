/**
 * PropertiesPanel (Ch8 v2) — the Notion "Properties" menu: show/hide each
 * property (eye toggle) and reorder them by dragging (HTML5 DnD, the same
 * pattern used elsewhere). Order + visibility persist to the column config.
 */

import { TYPE_META } from "@/app/databases/db-types";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";
import type { DatabaseColumn } from "@/shared/lib/vault/schemas";
import { Eye, EyeOff, GripVertical, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

export function PropertiesPanel({
  columns,
  onChange,
}: {
  columns: DatabaseColumn[];
  onChange: (next: DatabaseColumn[]) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const toggle = (i: number) =>
    onChange(columns.map((c, idx) => (idx === i ? { ...c, hidden: !c.hidden } : c)));
  const setAll = (hidden: boolean) => onChange(columns.map((c) => ({ ...c, hidden })));

  const drop = (target: number) => {
    if (dragIdx === null || dragIdx === target) return setDragIdx(null);
    const next = [...columns];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(target, 0, moved);
    onChange(next);
    setDragIdx(null);
  };

  const hiddenCount = columns.filter((c) => c.hidden).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="size-4" />
          Properties
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-caption font-medium text-muted-foreground">Properties</span>
          <button
            type="button"
            onClick={() => setAll(hiddenCount === 0)}
            className="text-caption text-muted-foreground hover:text-foreground"
          >
            {hiddenCount === 0 ? "Hide all" : "Show all"}
          </button>
        </div>
        <div className="flex flex-col">
          {columns.map((c, i) => {
            const Icon = TYPE_META[c.type].icon;
            return (
              <div
                key={c.key}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(i)}
                onDragEnd={() => setDragIdx(null)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-1 py-1.5 hover:bg-hover",
                  dragIdx === i && "opacity-50",
                )}
              >
                <GripVertical className="size-3.5 cursor-grab text-muted-foreground/40" />
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate text-body">{c.label}</span>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="text-muted-foreground/60 hover:text-foreground"
                  aria-label={c.hidden ? "Show property" : "Hide property"}
                >
                  {c.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            );
          })}
          {columns.length === 0 && (
            <p className="px-1 py-2 text-caption text-muted-foreground">No properties yet.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
