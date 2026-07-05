/**
 * DatabaseBoard — the Board view (Ch8). Groups rows by a select column; each
 * group value (plus an "empty" lane) is a column of cards. Cards drag between
 * lanes via native HTML5 drag-drop (the same pattern the Ch7 sidebar reparent
 * uses — no new dependency); dropping writes the lane's value to that row's
 * group field. Cards open the row as a Page on click.
 */

import { chipStyle, optionColor } from "@/shared/lib/db-options";
import { GROUP_NONE } from "@/shared/lib/db-query";
import type { DbRow } from "@/shared/lib/db-rows";
import { cn } from "@/shared/lib/utils";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import type { DatabaseColumn } from "@/shared/lib/vault/schemas";
import { useState } from "react";

export interface DatabaseBoardProps {
  columns: DatabaseColumn[];
  rows: DbRow[];
  /** The select column to group lanes by. */
  groupKey: string;
  onCellChange: (row: DbRow, key: string, value: unknown) => void;
  onOpenRow: (row: DbRow) => void;
}

export function DatabaseBoard({
  columns,
  rows,
  groupKey,
  onCellChange,
  onOpenRow,
}: DatabaseBoardProps) {
  const [dragPath, setDragPath] = useState<string | null>(null);
  const [overLane, setOverLane] = useState<string | null>(null);

  const groupCol = columns.find((c) => c.key === groupKey);
  // Lanes = the select's options + any present values + the empty lane, deduped.
  const present = new Set(
    rows.map((r) =>
      r.frontmatter[groupKey] == null ? GROUP_NONE : String(r.frontmatter[groupKey]),
    ),
  );
  const options = groupCol?.options ?? [];
  const lanes = [
    ...options,
    ...[...present].filter((v) => v !== GROUP_NONE && !options.includes(v)),
    GROUP_NONE,
  ];
  const cardColumns = columns.filter((c) => c.key !== groupKey);

  const drop = (lane: string) => {
    setOverLane(null);
    const row = rows.find((r) => r.path === dragPath);
    setDragPath(null);
    if (!row) return;
    const value = lane === GROUP_NONE ? undefined : lane;
    const current = row.frontmatter[groupKey] ?? undefined;
    if (String(current ?? "") !== String(value ?? "")) onCellChange(row, groupKey, value);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {lanes.map((lane) => {
        const laneRows = rows.filter(
          (r) =>
            (r.frontmatter[groupKey] == null ? GROUP_NONE : String(r.frontmatter[groupKey])) ===
            lane,
        );
        return (
          <div
            key={lane}
            onDragOver={(e) => {
              e.preventDefault();
              setOverLane(lane);
            }}
            onDragLeave={() => setOverLane((l) => (l === lane ? null : l))}
            onDrop={() => drop(lane)}
            className={cn(
              "flex w-64 shrink-0 flex-col rounded-lg border border-border bg-muted/20 p-2 transition-colors",
              overLane === lane && "border-foreground/30 bg-accent/40",
            )}
          >
            <div className="flex items-center gap-2 px-1.5 py-1">
              {lane === GROUP_NONE || !groupCol ? (
                <span className="text-caption font-medium text-muted-foreground">No value</span>
              ) : (
                <span
                  className="rounded-sm px-1.5 py-0.5 text-caption font-medium"
                  style={chipStyle(optionColor(groupCol, lane))}
                >
                  {lane}
                </span>
              )}
              <span className="text-caption tabular-nums text-muted-foreground">
                {laneRows.length}
              </span>
            </div>
            <div className="mt-1 flex flex-col gap-2">
              {laneRows.map((row) => (
                <button
                  key={row.path}
                  type="button"
                  draggable
                  onDragStart={() => setDragPath(row.path)}
                  onDragEnd={() => setDragPath(null)}
                  onClick={() => onOpenRow(row)}
                  className={cn(
                    "cursor-grab rounded-md border border-border bg-card px-3 py-2 text-left shadow-xs transition active:cursor-grabbing hover:border-foreground/20",
                    dragPath === row.path && "opacity-50",
                  )}
                >
                  <div className="flex items-center gap-1.5 text-body">
                    {typeof row.frontmatter.icon === "string" && (
                      <span className="shrink-0">{row.frontmatter.icon as string}</span>
                    )}
                    <span className="truncate font-medium">{row.title}</span>
                  </div>
                  {cardColumns.map((c) => {
                    const v = row.frontmatter[c.key];
                    if (v == null || v === "" || c.type === "checkbox" || c.type === "files")
                      return null;
                    if (Array.isArray(v) && v.length === 0) return null;
                    if (c.type === "select" || c.type === "status" || c.type === "multi_select") {
                      const vals = Array.isArray(v) ? v.map(String) : [String(v)];
                      return (
                        <div key={c.key} className="mt-1.5 flex flex-wrap gap-1">
                          {vals.map((val) => (
                            <span
                              key={val}
                              className="rounded-sm px-1.5 py-0.5 text-caption"
                              style={chipStyle(optionColor(c, val))}
                            >
                              {val}
                            </span>
                          ))}
                        </div>
                      );
                    }
                    const display = c.type === "relation" ? wikiTarget(String(v)) : String(v);
                    return (
                      <div key={c.key} className="mt-1 truncate text-caption text-muted-foreground">
                        <span className="opacity-70">{c.label}:</span> {display}
                      </div>
                    );
                  })}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
