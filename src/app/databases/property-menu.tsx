/**
 * PropertyMenu (Ch8 v2) — the per-column header menu (click a column header).
 * Rename inline, change type, sort, hide, duplicate, delete — the Notion column
 * dropdown. Only mounted for editable (custom) databases.
 */

import { TYPE_GROUPS, TYPE_META } from "@/app/databases/db-types";
import { useAllDatabases } from "@/app/databases/use-all-databases";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { NUMBER_FORMATS } from "@/shared/lib/db-format";
import type { DatabaseColumn, DatabaseColumnType, StatusGroup } from "@/shared/lib/vault/schemas";
import { ArrowDown, ArrowUp, Copy, EyeOff, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

const DEFAULT_STATUS_GROUPS: StatusGroup[] = [
  { label: "To-do", options: ["Not started"] },
  { label: "In progress", options: ["In progress"] },
  { label: "Complete", options: ["Done"] },
];

export function PropertyMenu({
  column,
  onChange,
  onDuplicate,
  onDelete,
  onSort,
  children,
}: {
  column: DatabaseColumn;
  onChange: (patch: Partial<DatabaseColumn>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSort: (dir: "asc" | "desc") => void;
  children: ReactNode;
}) {
  const changeType = (type: DatabaseColumnType) => {
    if (type === column.type) return;
    const patch: Partial<DatabaseColumn> = { type };
    if ((type === "select" || type === "multi_select") && !column.options) patch.options = [];
    if (type === "status" && !column.groups) patch.groups = DEFAULT_STATUS_GROUPS;
    onChange(patch);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <div className="flex items-center gap-1 p-1">
          <Input
            defaultValue={column.label}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== column.label) onChange({ label: v });
            }}
            className="h-8 flex-1 text-caption"
            placeholder="Property name"
          />
        </div>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <span className="flex items-center gap-2">
              {(() => {
                const Icon = TYPE_META[column.type].icon;
                return <Icon className="size-4 text-muted-foreground" />;
              })()}
              Type — {TYPE_META[column.type].label}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {TYPE_GROUPS.map((g) => (
              <div key={g.label}>
                <div className="px-2 py-1 text-caption text-muted-foreground">{g.label}</div>
                {g.types.map((t) => {
                  const Icon = TYPE_META[t].icon;
                  return (
                    <DropdownMenuItem key={t} onClick={() => changeType(t)}>
                      <Icon className="size-4 text-muted-foreground" />
                      {TYPE_META[t].label}
                    </DropdownMenuItem>
                  );
                })}
              </div>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {column.type === "relation" && <RelationConfig column={column} onChange={onChange} />}

        {column.type === "number" && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex items-center gap-2">
                <span className="text-muted-foreground">123</span>
                Format —{" "}
                {NUMBER_FORMATS.find((f) => f.name === (column.number_format ?? "plain"))?.label}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52">
              {NUMBER_FORMATS.map((f) => (
                <DropdownMenuItem key={f.name} onClick={() => onChange({ number_format: f.name })}>
                  {f.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onSort("asc")}>
          <ArrowUp className="size-4 text-muted-foreground" />
          Sort ascending
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSort("desc")}>
          <ArrowDown className="size-4 text-muted-foreground" />
          Sort descending
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange({ hidden: true })}>
          <EyeOff className="size-4 text-muted-foreground" />
          Hide in view
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="size-4 text-muted-foreground" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 className="size-4" />
          Delete property
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Relation-specific config section rendered inside `PropertyMenu` when
 * `column.type === "relation"`. Loads the available databases via hook so the
 * "Related to" picker can list them alongside the built-in Area/Page sets.
 */
function RelationConfig({
  column,
  onChange,
}: {
  column: DatabaseColumn;
  onChange: (patch: Partial<DatabaseColumn>) => void;
}) {
  const { databases } = useAllDatabases();
  const target = column.relation_target ?? "";
  const multi = column.relation_multiple !== false;

  return (
    <div className="flex flex-col gap-2 border-border border-t p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-muted-foreground">Related to</span>
        <Select value={target} onValueChange={(v) => onChange({ relation_target: v || undefined })}>
          <SelectTrigger size="sm" className="h-7 w-36">
            <SelectValue placeholder="Areas + Pages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Areas + Pages</SelectItem>
            <SelectItem value="areas">Areas</SelectItem>
            <SelectItem value="pages">Pages</SelectItem>
            {databases.map((db) => (
              <SelectItem key={db.slug} value={db.slug}>
                {db.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
        Allow multiple
        <Switch
          checked={multi}
          onCheckedChange={(c) => onChange({ relation_multiple: c ? undefined : false })}
        />
      </div>
    </div>
  );
}
