/**
 * Property type metadata (Ch8 v2) — icon + label per database column type, and
 * the grouped picker order. Shared by the property menu, the add-property menu,
 * and the column headers so a type's identity is defined once (Notion-style).
 */

import type { DatabaseColumnType } from "@/shared/lib/vault/schemas";
import {
  AtSign,
  Calendar,
  CheckSquare,
  Clock,
  Hash,
  Link2,
  List,
  Loader,
  Paperclip,
  Phone,
  Link as RelationIcon,
  Tag,
  Text,
  Type,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const TYPE_META: Record<DatabaseColumnType, { label: string; icon: LucideIcon }> = {
  text: { label: "Text", icon: Text },
  number: { label: "Number", icon: Hash },
  select: { label: "Select", icon: Tag },
  multi_select: { label: "Multi-select", icon: List },
  status: { label: "Status", icon: Loader },
  date: { label: "Date", icon: Calendar },
  checkbox: { label: "Checkbox", icon: CheckSquare },
  url: { label: "URL", icon: Link2 },
  email: { label: "Email", icon: AtSign },
  phone: { label: "Phone", icon: Phone },
  relation: { label: "Relation", icon: RelationIcon },
  files: { label: "Files & media", icon: Paperclip },
  created: { label: "Created time", icon: Clock },
  updated: { label: "Last edited time", icon: Clock },
};

/** The add-property picker, grouped like Notion's. */
export const TYPE_GROUPS: { label: string; types: DatabaseColumnType[] }[] = [
  { label: "Basic", types: ["text", "number", "checkbox", "date", "url", "email", "phone"] },
  { label: "Options", types: ["select", "multi_select", "status"] },
  { label: "Advanced", types: ["relation", "files"] },
  { label: "Automatic", types: ["created", "updated"] },
];

export const TitleIcon = Type;

/** A quick-pick emoji set for property-title icons (works inside the menu). */
export const PROPERTY_EMOJIS = [
  "📝",
  "🏷️",
  "⭐",
  "🔥",
  "✅",
  "⏳",
  "📅",
  "💰",
  "📊",
  "📈",
  "📉",
  "🎯",
  "🚀",
  "💡",
  "🔗",
  "📎",
  "👤",
  "👥",
  "🏢",
  "📍",
  "📧",
  "📞",
  "🌐",
  "🔒",
  "❤️",
  "💬",
  "📌",
  "🗂️",
  "🎨",
  "🧩",
  "⚙️",
  "🔧",
  "🟢",
  "🟡",
  "🔴",
  "🔵",
  "🟣",
  "🟠",
  "⚪",
  "⚫",
];
