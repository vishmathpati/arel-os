/**
 * DatabaseView — the one reusable Database surface (Ch8): a toolbar (Table /
 * Board switch + a Board group-by picker) over either the Table or Board view.
 * Reused by the Library, custom area databases, and embedded filtered resource
 * sections. Loading / error / empty states are handled here so every consumer
 * renders them identically. Only Table + Board ship this chapter (Contract).
 */

import { DatabaseBoard } from "@/app/databases/database-board";
import { DatabaseTable } from "@/app/databases/database-table";
import { PropertiesPanel } from "@/app/databases/properties-panel";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { DbRow } from "@/shared/lib/db-rows";
import { cn } from "@/shared/lib/utils";
import type { DatabaseColumn } from "@/shared/lib/vault/schemas";
import { Columns3, MoreHorizontal, Table2 } from "lucide-react";
import { type ReactNode, useState } from "react";

type ViewKind = "table" | "board";

export interface DatabaseViewProps {
  columns: DatabaseColumn[];
  rows: DbRow[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onCellChange: (row: DbRow, key: string, value: unknown) => void;
  onOpenRow: (row: DbRow) => void;
  onDeleteRow?: (row: DbRow) => void;
  onAddRow?: (title: string) => void;
  /** Empty-state copy when there are no rows. */
  emptyLabel?: string;
  /** When set, columns are editable (custom DB): header menus, +, resize, reorder.
   * Also renders the Properties panel in the toolbar. */
  onColumnsChange?: (next: DatabaseColumn[]) => void;
  /** Full-width toggle (custom DB). When provided, shows a "⋯" view-options menu. */
  fullWidth?: boolean;
  onFullWidthChange?: (next: boolean) => void;
  /** Extra controls on the right of the toolbar (e.g. a New-resource dialog). */
  toolbarExtra?: ReactNode;
}

export function DatabaseView({
  columns,
  rows,
  loading,
  error,
  onRetry,
  onCellChange,
  onOpenRow,
  onDeleteRow,
  onAddRow,
  emptyLabel = "Nothing here yet.",
  onColumnsChange,
  fullWidth,
  onFullWidthChange,
  toolbarExtra,
}: DatabaseViewProps) {
  const visibleColumns = columns.filter((c) => !c.hidden);
  const selectColumns = visibleColumns.filter((c) => c.type === "select" || c.type === "status");
  const [view, setView] = useState<ViewKind>("table");
  const [groupKey, setGroupKey] = useState<string>(selectColumns[0]?.key ?? "");

  const canBoard = selectColumns.length > 0;
  const activeGroup = selectColumns.some((c) => c.key === groupKey)
    ? groupKey
    : (selectColumns[0]?.key ?? "");

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <ViewTab
            active={view === "table"}
            onClick={() => setView("table")}
            icon={<Table2 className="size-4" />}
          >
            Table
          </ViewTab>
          {canBoard && (
            <ViewTab
              active={view === "board"}
              onClick={() => setView("board")}
              icon={<Columns3 className="size-4" />}
            >
              Board
            </ViewTab>
          )}
        </div>
        <div className="flex items-center gap-2">
          {view === "board" && canBoard && (
            <>
              <span className="text-caption text-muted-foreground">Group by</span>
              <Select value={activeGroup} onValueChange={setGroupKey}>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectColumns.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          {onColumnsChange && <PropertiesPanel columns={columns} onChange={onColumnsChange} />}
          {onFullWidthChange && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuCheckboxItem
                  checked={!!fullWidth}
                  onCheckedChange={(c) => onFullWidthChange(c === true)}
                >
                  Full width
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {toolbarExtra}
        </div>
      </div>

      {/* Body */}
      {loading ? null : error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load this database</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={onRetry}>
              Retry
            </Button>
          )}
        </Alert>
      ) : rows.length === 0 && !onAddRow ? (
        <EmptyState label={emptyLabel} />
      ) : view === "board" && canBoard ? (
        <DatabaseBoard
          columns={visibleColumns}
          rows={rows}
          groupKey={activeGroup}
          onCellChange={onCellChange}
          onOpenRow={onOpenRow}
        />
      ) : (
        <DatabaseTable
          columns={columns}
          rows={rows}
          onCellChange={onCellChange}
          onOpenRow={onOpenRow}
          onDeleteRow={onDeleteRow}
          onAddRow={onAddRow}
          onColumnsChange={onColumnsChange}
        />
      )}
    </div>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn("gap-1.5 text-muted-foreground", active && "bg-accent text-accent-foreground")}
    >
      {icon}
      {children}
    </Button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-card/40 px-6 py-12 text-center">
      <Table2 className="size-5 text-muted-foreground" />
      <p className="mt-2 text-body text-muted-foreground">{label}</p>
    </div>
  );
}
