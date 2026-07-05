/**
 * Shared quest presentation — status metadata and lifecycle order, used by the
 * list row, the detail header, and grouped sections so every surface agrees.
 * Same signal palette as projects: active = in-flight (info), done = success,
 * paused warns, planned and dropped are neutral.
 */

import type { QuestStatus } from "@/shared/lib/vault/schemas";

export interface QuestStatusMeta {
  label: string;
  dotClass: string;
  labelClass?: string;
}

export const QUEST_STATUS_META: Record<QuestStatus, QuestStatusMeta> = {
  planned: { label: "Planned", dotClass: "bg-muted-foreground/40" },
  active: { label: "Active", dotClass: "bg-info", labelClass: "text-info" },
  paused: { label: "Paused", dotClass: "bg-warning", labelClass: "text-warning" },
  done: { label: "Done", dotClass: "bg-success", labelClass: "text-success" },
  dropped: {
    label: "Dropped",
    dotClass: "bg-muted-foreground/40",
    labelClass: "text-muted-foreground/70",
  },
};

/** Lifecycle order for status pickers and grouped sections (D2). */
export const QUEST_STATUS_ORDER: readonly QuestStatus[] = [
  "planned",
  "active",
  "paused",
  "done",
  "dropped",
];

export function isQuestFinished(status: QuestStatus): boolean {
  return status === "done" || status === "dropped";
}
