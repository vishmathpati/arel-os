/**
 * Shared project presentation — status metadata and lifecycle order, used by the
 * list row, the detail header, and the Area page so every surface agrees. Status
 * is signal (allowed chroma per DESIGN.md, like quest lifecycle pills): active is
 * the "in flight" state (info), done is success, paused/waiting warn, backlog and
 * dropped are neutral.
 */

import type { ProjectStatus } from "@/shared/lib/vault/schemas";

export interface ProjectStatusMeta {
  label: string;
  /** Tailwind bg-* for the status dot. */
  dotClass: string;
  /** Tailwind text-* for the status label, if it carries signal. */
  labelClass?: string;
}

export const PROJECT_STATUS_META: Record<ProjectStatus, ProjectStatusMeta> = {
  backlog: { label: "Backlog", dotClass: "bg-muted-foreground/40" },
  active: { label: "Active", dotClass: "bg-info", labelClass: "text-info" },
  paused: { label: "Paused", dotClass: "bg-warning", labelClass: "text-warning" },
  waiting: { label: "Waiting", dotClass: "bg-warning", labelClass: "text-warning" },
  done: { label: "Done", dotClass: "bg-success", labelClass: "text-success" },
  dropped: {
    label: "Dropped",
    dotClass: "bg-muted-foreground/40",
    labelClass: "text-muted-foreground/70",
  },
};

/** Lifecycle order for status pickers and grouped sections (D3). */
export const PROJECT_STATUS_ORDER: readonly ProjectStatus[] = [
  "backlog",
  "active",
  "paused",
  "waiting",
  "done",
  "dropped",
];

export function isProjectFinished(status: ProjectStatus): boolean {
  return status === "done" || status === "dropped";
}
