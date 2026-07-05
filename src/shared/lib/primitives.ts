/**
 * Universal primitive type identity (D41). Single source of truth for the
 * icon + label + color of every user-pickable primitive type, so that anywhere a
 * typed item appears in a mixed list/picker/link-row it reads the same way: the
 * type's icon, tinted with its fixed muted type color (DESIGN.md — Primitive type
 * colors). Centralizes the icon choices that were previously duplicated across
 * the sidebar and individual pickers.
 *
 * Color is consumed inline (`style={{ color }}`) — a Tailwind `text-type-*` class
 * would be missed by the static scan, same as Area dots and option chips.
 *
 * Area is intentionally NOT here: an Area is self-identifying and keeps its own
 * per-area color (`src/shared/lib/areas.ts`), not a single shared "area" tint.
 */

import {
  Compass,
  Database,
  FileText,
  FolderKanban,
  Inbox,
  Library,
  ListTodo,
  type LucideIcon,
} from "lucide-react";

/** The primitive types that carry a universal type identity (Area excluded). */
export type PrimitiveTypeKey =
  | "task"
  | "project"
  | "quest"
  | "page"
  | "resource"
  | "database"
  | "inbox";

export interface PrimitiveMeta {
  label: string;
  icon: LucideIcon;
  /** Type color as a DESIGN.md token reference — used in inline `style={{ color }}`. */
  color: string;
}

export const PRIMITIVE_META: Record<PrimitiveTypeKey, PrimitiveMeta> = {
  task: { label: "Task", icon: ListTodo, color: "var(--color-type-task)" },
  project: { label: "Project", icon: FolderKanban, color: "var(--color-type-project)" },
  quest: { label: "Quest", icon: Compass, color: "var(--color-type-quest)" },
  page: { label: "Page", icon: FileText, color: "var(--color-type-page)" },
  resource: { label: "Resource", icon: Library, color: "var(--color-type-resource)" },
  database: { label: "Database", icon: Database, color: "var(--color-type-database)" },
  inbox: { label: "Inbox", icon: Inbox, color: "var(--color-type-inbox)" },
};

/** Resolve a type's identity meta, or null for an unknown/Area type. */
export function primitiveMeta(type: string | undefined): PrimitiveMeta | null {
  if (!type) return null;
  return PRIMITIVE_META[type as PrimitiveTypeKey] ?? null;
}
