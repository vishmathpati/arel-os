/**
 * DbCell — renders + inline-edits one database cell by column type (Ch8 + the
 * column-type expansion). Editors are official shadcn components throughout:
 * Input (text/number/url/email/phone), Select / grouped Select (select/status),
 * Popover + Command (relation, multi_select), Calendar (date), Checkbox. Files
 * reuse the editor's media pipeline (POST /vault/upload → media/). created /
 * updated are read-only auto columns sourced from frontmatter.
 */

import { OptionCell } from "@/app/databases/option-cell";
import { Badge } from "@/shared/components/ui/badge";
import { Calendar } from "@/shared/components/ui/calendar";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { useUploadFile } from "@/shared/hooks/use-upload-file";
import { AREA_OPTIONS } from "@/shared/lib/areas";
import { DATE_FORMATS, formatDateValue, formatNumberValue } from "@/shared/lib/db-format";
import { toDateStr } from "@/shared/lib/tasks/schedule";
import { cn } from "@/shared/lib/utils";
import { toWikilink, wikiTarget } from "@/shared/lib/vault/frontmatter";
import { type RelationOption, relationOptions } from "@/shared/lib/vault/relations";
import type { DatabaseColumn, NumberFormat } from "@/shared/lib/vault/schemas";
import { CalendarClock, Check, Loader2, Paperclip, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

const MEDIA_BASE = import.meta.env.VITE_VAULT_API ?? "http://localhost:5274";
const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

function mediaUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${MEDIA_BASE}/${path.replace(/^\//, "")}`;
}

function formatStamp(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string" && v) return [v];
  return [];
}

const CELL_INPUT =
  "h-full w-full bg-transparent px-3 text-body outline-none placeholder:text-muted-foreground/50 focus:bg-accent/40";

export function DbCell({
  column,
  value,
  row,
  onChange,
  onColumnChange,
}: {
  column: DatabaseColumn;
  value: unknown;
  /** Whole-row frontmatter — created/updated columns read their own stamps. */
  row: Record<string, unknown>;
  onChange: (next: unknown) => void;
  /** Persist column config edits (inline-created options) — custom DBs only. */
  onColumnChange?: (patch: Partial<DatabaseColumn>) => void;
}) {
  const str = value == null ? "" : String(value);

  switch (column.type) {
    case "checkbox":
      return (
        <div className="flex h-full items-center px-3">
          <Checkbox checked={value === true} onCheckedChange={(c) => onChange(c === true)} />
        </div>
      );

    case "number":
      return <NumberCell value={value} format={column.number_format} onChange={onChange} />;

    case "select":
    case "status":
    case "multi_select":
      return (
        <OptionCell
          column={column}
          value={value}
          onChange={onChange}
          onColumnChange={onColumnChange}
        />
      );

    case "date":
      return (
        <DateCell value={str} column={column} onChange={onChange} onColumnChange={onColumnChange} />
      );

    case "url":
    case "email":
    case "phone":
      // Plain editable text — no clickable link icon (avoids accidental redirects).
      return (
        <input
          key={str}
          defaultValue={str}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== str) onChange(v.trim() || undefined);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={CELL_INPUT}
        />
      );

    case "relation":
      return <RelationCell column={column} value={value} onChange={onChange} />;

    case "files":
      return <FilesCell value={toArray(value)} onChange={onChange} />;

    case "created":
      return <ReadOnlyStamp value={row.created} />;
    case "updated":
      return <ReadOnlyStamp value={row.updated} />;

    default:
      return (
        <input
          key={str}
          defaultValue={str}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== str) onChange(v.trim() || undefined);
          }}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={CELL_INPUT}
        />
      );
  }
}

function ReadOnlyStamp({ value }: { value: unknown }) {
  const v = typeof value === "string" ? value : "";
  return (
    <span className="flex h-full items-center px-3 text-caption text-muted-foreground">
      {v ? formatStamp(v) : ""}
    </span>
  );
}

/** Number cell: formatted display when idle, raw editable input on click. */
function NumberCell({
  value,
  format,
  onChange,
}: {
  value: unknown;
  format?: NumberFormat;
  onChange: (next: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const num = typeof value === "number" ? value : Number(value);
  const hasValue = value != null && value !== "" && !Number.isNaN(num);

  if (editing) {
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: focus on entering edit mode
        autoFocus
        type="number"
        defaultValue={hasValue ? String(num) : ""}
        onBlur={(e) => {
          setEditing(false);
          const v = e.target.value.trim();
          const next = v === "" ? undefined : Number(v);
          if (next !== value) onChange(next);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={cn(CELL_INPUT, "tabular-nums")}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="h-full w-full cursor-text px-3 text-left text-body tabular-nums hover:bg-accent/40"
    >
      {hasValue ? formatNumberValue(num, format) : ""}
    </button>
  );
}

function DateCell({
  value,
  column,
  onChange,
  onColumnChange,
}: {
  value: string;
  column: DatabaseColumn;
  onChange: (next: unknown) => void;
  onColumnChange?: (patch: Partial<DatabaseColumn>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group/cell flex h-full w-full items-center gap-1.5 px-3 text-left text-body hover:bg-accent/40"
        >
          {value ? (
            <span>{formatDateValue(value, column.date_format, column.include_time)}</span>
          ) : (
            <CalendarClock className="size-3.5 text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          mode="single"
          selected={value ? new Date(`${value}T00:00:00`) : undefined}
          onSelect={(d) => {
            if (d) onChange(toDateStr(d));
            setOpen(false);
          }}
          className="p-0"
        />
        {onColumnChange && (
          <div className="mt-2 flex flex-col gap-2 border-border border-t pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption text-muted-foreground">Date format</span>
              <Select
                value={column.date_format ?? "friendly"}
                onValueChange={(v) =>
                  onColumnChange({ date_format: v as NonNullable<DatabaseColumn["date_format"]> })
                }
              >
                <SelectTrigger size="sm" className="h-7 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((f) => (
                    <SelectItem key={f.name} value={f.name}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
              Include time
              <Switch
                checked={!!column.include_time}
                onCheckedChange={(c) => onColumnChange({ include_time: c })}
              />
            </div>
          </div>
        )}
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="mt-2 flex w-full items-center gap-1.5 rounded-md border-border border-t px-1 pt-2 text-caption text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Normalize a relation cell value to an array of wikilinks. */
function toWikilinks(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((x): x is string => typeof x === "string");
  if (typeof value === "string" && value) return [value];
  return [];
}

// One fetch per unique target per page-load — all cells sharing the same target
// reuse the same promise, so a 30-row table only calls the API once.
const _optionsCache = new Map<string, Promise<RelationOption[]>>();
function getOptions(target: string | undefined): Promise<RelationOption[]> {
  const key = target ?? "";
  if (!_optionsCache.has(key)) _optionsCache.set(key, relationOptions(target));
  // biome-ignore lint/style/noNonNullAssertion: just set above
  return _optionsCache.get(key)!;
}

/**
 * Editable relation cell: picks rows from the column's target (a DB slug,
 * "areas", "pages", or absent for legacy areas+pages). Supports single-value
 * and multi-value modes via `relation_multiple`.
 */
function RelationCell({
  column,
  value,
  onChange,
}: {
  column: DatabaseColumn;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<RelationOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const target = column.relation_target;
  const multi = column.relation_multiple !== false;
  const links = toWikilinks(value);

  // Load eagerly on mount — display labels are needed before the picker opens.
  // getOptions() caches by target so all cells in the same table share one fetch.
  useEffect(() => {
    if (!loaded) {
      void getOptions(target).then((opts) => {
        setOptions(opts);
        setLoaded(true);
      });
    }
  }, [loaded, target]);

  // For display before the picker is opened, areas are always recognizable.
  const areaBySlug = (slug: string) => AREA_OPTIONS.find((a) => a.slug === slug);
  const optBySlug = (slug: string) => options.find((o) => o.slug === slug);

  const isSelected = (slug: string) => links.includes(toWikilink(slug));

  const toggle = (slug: string) => {
    if (multi) {
      const wl = toWikilink(slug);
      const next = isSelected(slug) ? links.filter((l) => l !== wl) : [...links, wl];
      onChange(next.length === 0 ? undefined : next.length === 1 ? next[0] : next);
      // Keep popover open for multi-select
    } else {
      onChange(toWikilink(slug));
      setOpen(false);
    }
  };

  const clear = () => {
    onChange(undefined);
    if (!multi) setOpen(false);
  };

  // Determine if we're in legacy (areas+pages) mode for grouping
  const isLegacy = !target;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-full w-full flex-wrap items-center gap-1 px-3 text-left hover:bg-accent/40"
        >
          {links.length === 0 ? (
            <span className="w-full" />
          ) : (
            links.map((wl) => {
              const slug = wikiTarget(wl);
              const area = areaBySlug(slug);
              const opt = optBySlug(slug);
              return area && (!target || target === "areas") ? (
                <span key={slug} className="flex items-center gap-1.5 text-body">
                  <span className="size-2 rounded-full" style={{ backgroundColor: area.color }} />
                  {area.label}
                </span>
              ) : (
                <Badge key={slug} variant="secondary" className="font-normal">
                  {opt?.label || slug}
                </Badge>
              );
            })
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={target ? `Search ${target}…` : "Link an area or page…"} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            {links.length > 0 && (
              <CommandGroup>
                <CommandItem onSelect={clear}>
                  <X className="size-4 text-muted-foreground" />
                  {multi && links.length > 1 ? "Clear all" : "Clear"}
                </CommandItem>
              </CommandGroup>
            )}
            {!loaded ? (
              <CommandGroup>
                <CommandItem disabled>
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  Loading…
                </CommandItem>
              </CommandGroup>
            ) : isLegacy ? (
              <>
                <CommandGroup heading="Areas">
                  {options
                    .filter((o) => AREA_OPTIONS.some((a) => a.slug === o.slug))
                    .map((o) => (
                      <CommandItem
                        key={o.slug}
                        value={`area ${o.label}`}
                        onSelect={() => toggle(o.slug)}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: o.color }}
                        />
                        {o.label}
                        {multi && isSelected(o.slug) && <Check className="ml-auto size-4" />}
                      </CommandItem>
                    ))}
                </CommandGroup>
                {options.filter((o) => !AREA_OPTIONS.some((a) => a.slug === o.slug)).length > 0 && (
                  <CommandGroup heading="Pages">
                    {options
                      .filter((o) => !AREA_OPTIONS.some((a) => a.slug === o.slug))
                      .map((o) => (
                        <CommandItem
                          key={o.slug}
                          value={`page ${o.label}`}
                          onSelect={() => toggle(o.slug)}
                        >
                          {o.label}
                          {multi && isSelected(o.slug) && <Check className="ml-auto size-4" />}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
              </>
            ) : (
              <CommandGroup>
                {options.map((o) => (
                  <CommandItem key={o.slug} value={o.label} onSelect={() => toggle(o.slug)}>
                    {o.color && (
                      <span className="size-2 rounded-full" style={{ backgroundColor: o.color }} />
                    )}
                    {o.label}
                    {multi && isSelected(o.slug) && <Check className="ml-auto size-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FilesCell({ value, onChange }: { value: string[]; onChange: (next: unknown) => void }) {
  const { uploadFile, isUploading } = useUploadFile();

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded: string[] = [];
    for (const f of Array.from(files)) {
      const res = await uploadFile(f);
      uploaded.push(res.key);
    }
    onChange([...value, ...uploaded]);
  };

  const remove = (path: string) => {
    const next = value.filter((p) => p !== path);
    onChange(next.length ? next : undefined);
  };

  return (
    <div className="flex h-full w-full flex-wrap items-center gap-1.5 px-3 py-1.5">
      {value.map((path) => {
        const name = path.split("/").pop() ?? path;
        return IMAGE_RE.test(path) ? (
          <span key={path} className="group/f relative">
            <a href={mediaUrl(path)} target="_blank" rel="noreferrer">
              <img
                src={mediaUrl(path)}
                alt={name}
                className="size-8 rounded border border-border object-cover"
              />
            </a>
            <button
              type="button"
              onClick={() => remove(path)}
              className="-right-1 -top-1 absolute hidden size-4 items-center justify-center rounded-full bg-background text-muted-foreground shadow group-hover/f:flex hover:text-error"
              aria-label="Remove file"
            >
              <X className="size-3" />
            </button>
          </span>
        ) : (
          <Badge key={path} variant="secondary" className="gap-1 font-normal">
            <a href={mediaUrl(path)} target="_blank" rel="noreferrer" className="max-w-32 truncate">
              {name}
            </a>
            <button type="button" onClick={() => remove(path)} aria-label="Remove file">
              <X className="size-3 hover:text-error" />
            </button>
          </Badge>
        );
      })}
      <label className="flex size-7 cursor-pointer items-center justify-center rounded text-muted-foreground hover:bg-hover hover:text-foreground">
        {isUploading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : value.length ? (
          <Plus className="size-3.5" />
        ) : (
          <Paperclip className="size-3.5" />
        )}
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            void onPick(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
