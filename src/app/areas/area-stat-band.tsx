/**
 * AreaStatBand — the overview row at the top of an Area page. Four count cards
 * (Quests / Projects / Tasks / Resources) answering "what lives here" before you
 * scroll. Copies the flagship TaskStatBand card pattern (D22) — same border,
 * surface, caption+icon label, and number scale — but neutral: an Area count is
 * not a signal, so no error/success accents. Only Tasks is live until Ch 5–8.
 */

import { Compass, FileStack, FolderKanban, ListTodo, type LucideIcon } from "lucide-react";

export interface AreaCounts {
  quests: number;
  projects: number;
  tasks: number;
  resources: number;
}

interface CardDef {
  key: keyof AreaCounts;
  label: string;
  icon: LucideIcon;
}

const CARDS: readonly CardDef[] = [
  { key: "quests", label: "Quests", icon: Compass },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "tasks", label: "Tasks", icon: ListTodo },
  { key: "resources", label: "Resources", icon: FileStack },
];

export function AreaStatBand({ counts }: { counts: AreaCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon }) => (
        <div
          key={key}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3"
        >
          <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
            <Icon className="size-4" />
            {label}
          </span>
          <span className="text-2xl font-semibold tabular-nums">{counts[key]}</span>
        </div>
      ))}
    </div>
  );
}
