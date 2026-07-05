/**
 * Shared presentational primitives for the software-project dashboard tabs —
 * the state pill, sub-section labels, and the per-tab empty state. Token-only
 * (DESIGN.md): color is reserved for the health signal; everything else neutral.
 */

import type { ProjectState } from "@/shared/lib/project-dashboard/snapshot";
import { cn } from "@/shared/lib/utils";
import type { LucideIcon } from "lucide-react";

const STATE_META: Record<ProjectState, { label: string; cls: string; dot: string }> = {
  healthy: { label: "Healthy", cls: "bg-success/15 text-success", dot: "bg-success" },
  watch: { label: "Watch", cls: "bg-warning/15 text-warning", dot: "bg-warning" },
  blocked: { label: "Blocked", cls: "bg-error/15 text-error", dot: "bg-error" },
  unknown: {
    label: "Unknown",
    cls: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
};

export function StatePill({ state }: { state: ProjectState }) {
  const s = STATE_META[state];
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-caption font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

export function StateDot({ state }: { state: ProjectState }) {
  return <span className={cn("size-2 shrink-0 rounded-full", STATE_META[state].dot)} />;
}

/** A small uppercase sub-section label inside a tab. */
export function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

/** Centered empty/placeholder state for a tab (FUNDAMENTALS empty-state pattern). */
export function EmptyTab({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
      <Icon className="size-5 text-muted-foreground" />
      <p className="mt-3 text-subheading font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-caption text-muted-foreground">{hint}</p>
    </div>
  );
}
