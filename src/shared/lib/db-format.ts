/**
 * Date + number display formatting for database cells (Ch8 v3) — the Notion
 * "secondary options" (date format / include time, number format). Pure; the
 * stored value is unchanged, only its presentation. Browser-only (uses Intl +
 * the current date for relative formatting).
 */

import type { DateFormat, NumberFormat } from "@/shared/lib/vault/schemas";

export const DATE_FORMATS: { name: DateFormat; label: string }[] = [
  { name: "full", label: "Full date" },
  { name: "friendly", label: "Month DD, YYYY" },
  { name: "numeric", label: "MM/DD/YYYY" },
  { name: "iso", label: "ISO (YYYY-MM-DD)" },
  { name: "relative", label: "Relative" },
];

export const NUMBER_FORMATS: { name: NumberFormat; label: string }[] = [
  { name: "plain", label: "Number" },
  { name: "comma", label: "Number with commas" },
  { name: "percent", label: "Percent" },
  { name: "usd", label: "Dollar ($)" },
  { name: "eur", label: "Euro (€)" },
  { name: "gbp", label: "Pound (£)" },
  { name: "inr", label: "Rupee (₹)" },
];

function relative(d: Date): string {
  const today = new Date();
  const day = 86_400_000;
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const b = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((a - b) / day);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 0) return `In ${days} days`;
  return `${-days} days ago`;
}

export function formatDateValue(
  value: string,
  fmt: DateFormat = "friendly",
  includeTime = false,
): string {
  const hasTime = value.length > 10;
  const d = new Date(hasTime ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  let out: string;
  switch (fmt) {
    case "full":
      out = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
      break;
    case "numeric":
      out = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
      break;
    case "iso":
      out = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      break;
    case "relative":
      out = relative(d);
      break;
    default:
      out = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  if (includeTime && hasTime) {
    out += `, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return out;
}

export function formatNumberValue(value: number, fmt: NumberFormat = "plain"): string {
  if (Number.isNaN(value)) return "";
  switch (fmt) {
    case "comma":
      return value.toLocaleString("en-US");
    case "percent":
      return `${value.toLocaleString("en-US")}%`;
    case "usd":
      return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
    case "eur":
      return value.toLocaleString("en-US", { style: "currency", currency: "EUR" });
    case "gbp":
      return value.toLocaleString("en-US", { style: "currency", currency: "GBP" });
    case "inr":
      return value.toLocaleString("en-IN", { style: "currency", currency: "INR" });
    default:
      return String(value);
  }
}
