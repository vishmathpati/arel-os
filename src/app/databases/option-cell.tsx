/**
 * OptionCell (Ch8 v3) — the Notion select / multi-select / status cell. Closed:
 * colored chips (empty shows nothing — no dashes). Open: search, pick, or create
 * an option inline (auto-colored, persisted). Each option has a "⋯" menu with a
 * rename field, Delete, and the universal named color picker (Default + 9
 * colors, swatch + check). Status options are grouped.
 */

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import {
  PICKER_COLORS,
  addOption,
  chipStyle,
  columnOptions,
  optionColor,
} from "@/shared/lib/db-options";
import { cn } from "@/shared/lib/utils";
import type { DatabaseColumn } from "@/shared/lib/vault/schemas";
import { Check, ChevronsUpDown, MoreHorizontal, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

function Chip({
  column,
  value,
  onRemove,
}: {
  column: DatabaseColumn;
  value: string;
  onRemove?: () => void;
}) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-sm px-1.5 py-0.5 text-caption"
      style={chipStyle(optionColor(column, value))}
    >
      <span className="truncate">{value}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-60 hover:opacity-100"
          aria-label={`Remove ${value}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

export function OptionCell({
  column,
  value,
  onChange,
  onColumnChange,
}: {
  column: DatabaseColumn;
  /** string for select/status, string[] for multi_select. */
  value: unknown;
  onChange: (next: unknown) => void;
  /** Persist new/edited options back to the column config. */
  onColumnChange?: (patch: Partial<DatabaseColumn>) => void;
}) {
  const multi = column.type === "multi_select";
  const selected = multi
    ? Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : []
    : typeof value === "string" && value
      ? [value]
      : [];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const all = useMemo(() => columnOptions(column), [column]);
  const filtered = query ? all.filter((o) => o.toLowerCase().includes(query.toLowerCase())) : all;
  const canCreate =
    !!onColumnChange &&
    query.trim().length > 0 &&
    !all.some((o) => o.toLowerCase() === query.trim().toLowerCase());

  const pick = (opt: string) => {
    if (multi) {
      onChange(selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt]);
    } else {
      onChange(opt);
      setOpen(false);
    }
    setQuery("");
  };

  const create = () => {
    const name = query.trim();
    if (!name || !onColumnChange) return;
    onColumnChange(addOption(column, name));
    pick(name);
  };

  const recolor = (opt: string, color: string) =>
    onColumnChange?.({ option_colors: { ...(column.option_colors ?? {}), [opt]: color } });

  const removeOption = (opt: string) => {
    if (!onColumnChange) return;
    const colors = { ...(column.option_colors ?? {}) };
    delete colors[opt];
    if (column.type === "status") {
      onColumnChange({
        groups: (column.groups ?? []).map((g) => ({
          ...g,
          options: g.options.filter((o) => o !== opt),
        })),
        option_colors: colors,
      });
    } else {
      onColumnChange({
        options: (column.options ?? []).filter((o) => o !== opt),
        option_colors: colors,
      });
    }
  };

  const renameOption = (oldName: string, newName: string) => {
    if (!onColumnChange || !newName.trim() || newName === oldName) return;
    const name = newName.trim();
    const colors = { ...(column.option_colors ?? {}) };
    if (colors[oldName]) {
      colors[name] = colors[oldName];
      delete colors[oldName];
    }
    if (column.type === "status") {
      onColumnChange({
        groups: (column.groups ?? []).map((g) => ({
          ...g,
          options: g.options.map((o) => (o === oldName ? name : o)),
        })),
        option_colors: colors,
      });
    } else {
      onColumnChange({
        options: (column.options ?? []).map((o) => (o === oldName ? name : o)),
        option_colors: colors,
      });
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/cell flex h-full w-full items-center gap-1 overflow-hidden px-3 py-1.5 text-left hover:bg-accent/40"
        >
          <span className="flex flex-1 flex-wrap items-center gap-1">
            {selected.map((v) => (
              <Chip key={v} column={column} value={v} />
            ))}
          </span>
          <ChevronsUpDown className="size-3 shrink-0 text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-border border-b p-2">
          <div className="flex flex-wrap items-center gap-1">
            {multi &&
              selected.map((v) => (
                <Chip key={v} column={column} value={v} onRemove={() => pick(v)} />
              ))}
            <input
              // biome-ignore lint/a11y/noAutofocus: focus the search the moment the picker opens
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (canCreate) create();
                  else if (filtered[0]) pick(filtered[0]);
                }
              }}
              placeholder={onColumnChange ? "Search or create…" : "Search…"}
              className="h-6 min-w-24 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <ScrollArea className="max-h-64">
          <div className="p-1">
            <p className="px-1.5 py-1 text-caption text-muted-foreground">
              {onColumnChange ? "Select an option or create one" : "Select an option"}
            </p>
            {filtered.map((opt) => (
              <div
                key={opt}
                className="group/opt flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-hover"
              >
                <button
                  type="button"
                  onClick={() => pick(opt)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  {multi && (
                    <Check
                      className={cn(
                        "size-3.5",
                        selected.includes(opt) ? "opacity-100" : "opacity-0",
                      )}
                    />
                  )}
                  <Chip column={column} value={opt} />
                </button>
                {!multi && selected.includes(opt) && <Check className="size-3.5 shrink-0" />}
                {onColumnChange && (
                  <OptionMenu
                    column={column}
                    option={opt}
                    onRename={(n) => renameOption(opt, n)}
                    onRecolor={(c) => recolor(opt, c)}
                    onDelete={() => removeOption(opt)}
                  />
                )}
              </div>
            ))}

            {canCreate && (
              <button
                type="button"
                onClick={create}
                className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-body hover:bg-hover"
              >
                <span className="text-muted-foreground">Create</span>
                <Chip column={{ ...column, option_colors: {} }} value={query.trim()} />
              </button>
            )}

            {filtered.length === 0 && !canCreate && (
              <p className="px-1.5 py-2 text-caption text-muted-foreground">No options.</p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

/** Per-option "⋯" menu: rename, delete, and the universal named color picker. */
function OptionMenu({
  column,
  option,
  onRename,
  onRecolor,
  onDelete,
}: {
  column: DatabaseColumn;
  option: string;
  onRename: (name: string) => void;
  onRecolor: (color: string) => void;
  onDelete: () => void;
}) {
  const current = optionColor(column, option);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 text-muted-foreground/50 opacity-0 hover:text-foreground group-hover/opt:opacity-100"
          aria-label="Edit option"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-56 p-0">
        <div className="border-border border-b p-2">
          <input
            // biome-ignore lint/a11y/noAutofocus: focus rename when the menu opens
            autoFocus
            defaultValue={option}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onBlur={(e) => onRename(e.target.value)}
            className="h-7 w-full rounded-md border border-input bg-transparent px-2 text-body outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="p-1">
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body text-error hover:bg-hover"
          >
            <Trash2 className="size-4" />
            Delete
          </button>
        </div>
        <div className="border-border border-t p-1">
          <p className="px-2 py-1 text-caption text-muted-foreground">Colors</p>
          {PICKER_COLORS.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => onRecolor(c.name)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-body hover:bg-hover"
            >
              <span
                className="size-4 shrink-0 rounded border border-border/60"
                style={{ backgroundColor: `var(--tag-${c.name})` }}
              />
              <span className="flex-1">{c.label}</span>
              {current === c.name && <Check className="size-3.5" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
