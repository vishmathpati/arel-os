/**
 * DatabaseTable (Ch8 v2) — a Notion-style data table. Properties are managed
 * INSIDE the table: each header opens a property menu (rename/type/sort/hide/
 * duplicate/delete), a "+" at the end adds a property, headers drag to reorder
 * and have a resize handle. The Name cell is inline-editable with a hover "Open"
 * affordance; a ghost "+ New" row at the bottom asks for the name before adding.
 * When `onColumnsChange` is absent (Library), columns are fixed (no editing).
 */

import { DbCell } from "@/app/databases/db-cell";
import { TYPE_META, TitleIcon } from "@/app/databases/db-types";
import { NewPropertyMenu } from "@/app/databases/new-property-menu";
import { ColumnIconView, PropertyIconPicker } from "@/app/databases/property-icon-picker";
import { PropertyMenu } from "@/app/databases/property-menu";
import { sortRows } from "@/shared/lib/db-query";
import type { DbRow } from "@/shared/lib/db-rows";
import { cn } from "@/shared/lib/utils";
import { slugify } from "@/shared/lib/vault/paths";
import type { DatabaseColumn, DatabaseColumnType, StatusGroup } from "@/shared/lib/vault/schemas";
import { Maximize2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const TITLE_W = 260;
const PLUS_W = 40;
const DEFAULT_W: Partial<Record<DatabaseColumnType, number>> = {
  checkbox: 100,
  number: 120,
  date: 160,
  created: 184,
  updated: 184,
};
const colWidth = (c: DatabaseColumn) => c.width ?? DEFAULT_W[c.type] ?? 180;

const DEFAULT_STATUS_GROUPS: StatusGroup[] = [
  { label: "To-do", options: ["Not started"] },
  { label: "In progress", options: ["In progress"] },
  { label: "Complete", options: ["Done"] },
];

export interface DatabaseTableProps {
  /** All columns, including hidden ones. */
  columns: DatabaseColumn[];
  rows: DbRow[];
  onCellChange: (row: DbRow, key: string, value: unknown) => void;
  onOpenRow: (row: DbRow) => void;
  onDeleteRow?: (row: DbRow) => void;
  onAddRow?: (title: string) => void;
  /** When set, columns are editable (custom DB): menus, +, resize, reorder. */
  onColumnsChange?: (next: DatabaseColumn[]) => void;
}

export function DatabaseTable({
  columns,
  rows,
  onCellChange,
  onOpenRow,
  onDeleteRow,
  onAddRow,
  onColumnsChange,
}: DatabaseTableProps) {
  const editable = !!onColumnsChange;
  const visible = columns.filter((c) => !c.hidden);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [resize, setResize] = useState<{ key: string; startX: number; startW: number } | null>(
    null,
  );
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [liveWidths, setLiveWidths] = useState<Record<string, number>>({});

  // Resize: track pointer while a handle is held; commit width on release.
  useEffect(() => {
    if (!resize) return;
    const move = (e: PointerEvent) => {
      const w = Math.max(80, resize.startW + (e.clientX - resize.startX));
      setLiveWidths((p) => ({ ...p, [resize.key]: w }));
    };
    const up = () => {
      setLiveWidths((p) => {
        const w = p[resize.key];
        if (w && onColumnsChange) {
          onColumnsChange(
            columns.map((c) => (c.key === resize.key ? { ...c, width: Math.round(w) } : c)),
          );
        }
        const { [resize.key]: _drop, ...rest } = p;
        return rest;
      });
      setResize(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [resize, columns, onColumnsChange]);

  const widthOf = (c: DatabaseColumn) => liveWidths[c.key] ?? colWidth(c);
  const template = [
    `${TITLE_W}px`,
    ...visible.map((c) => `${widthOf(c)}px`),
    editable ? `${PLUS_W}px` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const minWidth = TITLE_W + visible.reduce((s, c) => s + widthOf(c), 0) + (editable ? PLUS_W : 0);

  const sorted = sort ? sortRows(rows, sort.key, sort.dir) : rows;

  // ── column mutations ──────────────────────────────────────────────────────
  const patchColumn = (key: string, patch: Partial<DatabaseColumn>) =>
    onColumnsChange?.(columns.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const deleteColumn = (key: string) => onColumnsChange?.(columns.filter((c) => c.key !== key));
  const duplicateColumn = (key: string) => {
    const src = columns.find((c) => c.key === key);
    if (!src) return;
    const keys = new Set(columns.map((c) => c.key));
    let nk = `${src.key}-copy`;
    let n = 2;
    while (keys.has(nk)) nk = `${src.key}-copy-${n++}`;
    const idx = columns.findIndex((c) => c.key === key);
    const next = [...columns];
    next.splice(idx + 1, 0, { ...src, key: nk, label: `${src.label} copy` });
    onColumnsChange?.(next);
  };
  const addColumn = (type: DatabaseColumnType, name: string) => {
    const base = slugify(name) || "field";
    const keys = new Set(columns.map((c) => c.key));
    let key = base;
    let n = 2;
    while (keys.has(key)) key = `${base}-${n++}`;
    const col: DatabaseColumn = { key, label: name, type };
    if (type === "select" || type === "multi_select") col.options = [];
    if (type === "status") col.groups = DEFAULT_STATUS_GROUPS;
    onColumnsChange?.([...columns, col]);
  };
  const reorder = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const from = columns.findIndex((c) => c.key === fromKey);
    const to = columns.findIndex((c) => c.key === toKey);
    if (from < 0 || to < 0) return;
    const next = [...columns];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onColumnsChange?.(next);
  };

  const toggleSort = (key: string, dir: "asc" | "desc") =>
    setSort((s) => (s && s.key === key && s.dir === dir ? null : { key, dir }));

  const commitAdd = () => {
    const t = draft.trim();
    if (!t || !onAddRow) return;
    setDraft("");
    onAddRow(t);
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      {/* Header */}
      <div
        className="grid h-9 items-stretch border-b border-border text-caption text-muted-foreground"
        style={{ gridTemplateColumns: template, minWidth }}
      >
        <div className="flex items-center gap-1.5 px-3">
          <TitleIcon className="size-3.5" />
          Name
        </div>
        {visible.map((c) => {
          const Icon = TYPE_META[c.type].icon;
          const typeIcon = <Icon className="size-3.5 shrink-0 text-muted-foreground" />;
          return (
            <div
              key={c.key}
              className="relative flex items-center gap-1.5 border-border/40 border-l px-3"
              draggable={editable}
              onDragStart={() => editable && setDragKey(c.key)}
              onDragOver={(e) => editable && e.preventDefault()}
              onDrop={() => {
                if (editable && dragKey) reorder(dragKey, c.key);
                setDragKey(null);
              }}
              onDragEnd={() => setDragKey(null)}
            >
              {editable ? (
                <>
                  <PropertyIconPicker
                    value={c.icon}
                    color={c.icon_color}
                    fallback={typeIcon}
                    onChange={(icon, icon_color) => patchColumn(c.key, { icon, icon_color })}
                  />
                  <PropertyMenu
                    column={c}
                    onChange={(patch) => patchColumn(c.key, patch)}
                    onDuplicate={() => duplicateColumn(c.key)}
                    onDelete={() => deleteColumn(c.key)}
                    onSort={(dir) => toggleSort(c.key, dir)}
                  >
                    <button
                      type="button"
                      className={cn(
                        "-mx-1 flex h-full min-w-0 flex-1 items-center rounded px-1 hover:bg-hover",
                        sort?.key === c.key && "text-foreground",
                      )}
                    >
                      <span className="truncate">{c.label}</span>
                    </button>
                  </PropertyMenu>
                </>
              ) : (
                <span className="flex h-full min-w-0 flex-1 items-center gap-1.5">
                  {c.icon ? (
                    <ColumnIconView
                      icon={c.icon}
                      color={c.icon_color}
                      className="size-3.5 shrink-0"
                    />
                  ) : (
                    typeIcon
                  )}
                  <span className="truncate">{c.label}</span>
                </span>
              )}
              {editable && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Resize column"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setResize({ key: c.key, startX: e.clientX, startW: widthOf(c) });
                  }}
                  className="-mr-1 absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize hover:bg-foreground/20"
                />
              )}
            </div>
          );
        })}
        {editable && <NewPropertyMenu onCreate={addColumn} />}
      </div>

      {/* Rows */}
      {sorted.map((row) => (
        <div
          key={row.path}
          className="group/row grid min-h-9 items-stretch border-b border-border/60 last:border-b-0"
          style={{ gridTemplateColumns: template, minWidth }}
        >
          <NameCell
            row={row}
            onRename={(title) => onCellChange(row, "title", title || undefined)}
            onOpen={() => onOpenRow(row)}
            onDelete={onDeleteRow ? () => onDeleteRow(row) : undefined}
          />
          {visible.map((c) => (
            <div key={c.key} className="flex items-stretch border-border/40 border-l">
              <DbCell
                column={c}
                value={row.frontmatter[c.key]}
                row={row.frontmatter}
                onChange={(v) => onCellChange(row, c.key, v)}
                onColumnChange={editable ? (patch) => patchColumn(c.key, patch) : undefined}
              />
            </div>
          ))}
          {editable && <div />}
        </div>
      ))}

      {/* Ghost new-row — type the name, then it's added */}
      {onAddRow &&
        (adding ? (
          <div className="flex h-9 items-center gap-2 px-3" style={{ minWidth }}>
            <Plus className="size-4 shrink-0 text-muted-foreground" />
            <input
              // biome-ignore lint/a11y/noAutofocus: focus the name field the moment the row opens
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAdd();
                else if (e.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              onBlur={() => {
                commitAdd();
                setAdding(false);
              }}
              placeholder="Name, then Enter…"
              className="h-7 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground/60"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-9 w-full items-center gap-2 px-3 text-left text-muted-foreground hover:bg-hover"
            style={{ minWidth }}
          >
            <Plus className="size-4 shrink-0" />
            <span className="text-body">New</span>
          </button>
        ))}
    </div>
  );
}

/** Inline-editable Name cell with a hover "Open" (and optional delete) action. */
function NameCell({
  row,
  onRename,
  onOpen,
  onDelete,
}: {
  row: DbRow;
  onRename: (title: string) => void;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.title);

  return (
    <div className="group/name flex items-center gap-1 px-3 py-1.5">
      {typeof row.frontmatter.icon === "string" && (
        <span className="shrink-0">{row.frontmatter.icon as string}</span>
      )}
      {editing ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: focus on entering edit mode
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft !== row.title) onRename(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            else if (e.key === "Escape") {
              setDraft(row.title);
              setEditing(false);
            }
          }}
          className="h-6 min-w-0 flex-1 bg-transparent text-body outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(row.title);
            setEditing(true);
          }}
          className="min-w-0 flex-1 cursor-text truncate text-left text-body"
        >
          {row.title || <span className="text-muted-foreground/50">Untitled</span>}
        </button>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="flex shrink-0 items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-caption text-muted-foreground opacity-0 transition hover:text-foreground group-hover/name:opacity-100"
      >
        <Maximize2 className="size-3" />
        Open
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 text-muted-foreground/40 opacity-0 transition hover:text-error group-hover/name:opacity-100"
          aria-label="Delete row"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}
