/**
 * InboxTriageEditor — the panel that expands beneath an inbox row (Chapter 9,
 * D32). Mirrors the flagship TaskInlineEditor: direct controls, no dropdowns.
 * Triage sets the item's kind/title (persisted to the inbox file) and a
 * destination (area + optional project/quest, transient) → "File it" moves it to
 * its real home and clears it from the inbox. Discard soft-deletes it.
 */

import type { TaskLinkOption, TaskProjectOption } from "@/app/tasks/task-inline-editor";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { AREA_OPTIONS } from "@/shared/lib/areas";
import type { FileDestination, InboxItem } from "@/shared/lib/inbox-data";
import { cn } from "@/shared/lib/utils";
import type { InboxFrontmatter, InboxKind, ResourceKind } from "@/shared/lib/vault/schemas";
import { ArrowRight, ListTodo, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

interface InboxTriageEditorProps {
  item: InboxItem;
  onPatch: (item: InboxItem, patch: Partial<InboxFrontmatter>) => void;
  onFile: (item: InboxItem, dest: FileDestination) => void;
  onDiscard: (item: InboxItem) => void;
  projectOptions?: TaskProjectOption[];
  questOptions?: TaskLinkOption[];
}

const PILL_BASE = "rounded-md px-2.5 py-1 text-caption transition-colors border border-transparent";
const PILL_OFF = "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground";
const PILL_ON = "border-transparent bg-accent text-accent-foreground";

const KIND_PILLS: ReadonlyArray<{ value: InboxKind; label: string }> = [
  { value: "task", label: "Task" },
  { value: "resource", label: "Resource" },
];

const RESOURCE_KINDS: readonly ResourceKind[] = [
  "link",
  "tweet",
  "video",
  "article",
  "image",
  "note",
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-16 shrink-0 pt-1.5 text-caption text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

export function InboxTriageEditor({
  item,
  onPatch,
  onFile,
  onDiscard,
  projectOptions,
  questOptions,
}: InboxTriageEditorProps) {
  const [title, setTitle] = useState(item.title ?? "");
  const [area, setArea] = useState<string | null>(null);
  const [project, setProject] = useState<string | null>(null);
  const [quest, setQuest] = useState<string | null>(null);

  const areaProjects = (projectOptions ?? []).filter((p) => p.area === area);
  const areaQuests = (questOptions ?? []).filter((q) => q.area === area);

  const commitTitle = () => {
    const next = title.trim();
    if (next && next !== (item.title ?? "")) onPatch(item, { title: next });
  };

  const pickArea = (slug: string) => {
    if (area === slug) {
      setArea(null);
      setProject(null);
      setQuest(null);
      return;
    }
    setArea(slug);
    setProject(null);
    setQuest(null);
  };

  return (
    <div className="flex flex-col gap-3.5 bg-card/40 px-4 pt-1 pb-4 pl-[3.25rem]">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commitTitle}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="Title"
        className="h-auto border-0 bg-transparent px-0 py-0 text-body font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
      />

      <Field label="Kind">
        {KIND_PILLS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPatch(item, { kind: p.value })}
            className={cn(PILL_BASE, item.kind === p.value ? PILL_ON : PILL_OFF)}
          >
            {p.label}
          </button>
        ))}
      </Field>

      {item.kind === "resource" && (
        <Field label="Type">
          {RESOURCE_KINDS.map((rk) => (
            <button
              key={rk}
              type="button"
              onClick={() => onPatch(item, { resource_kind: rk })}
              className={cn(
                PILL_BASE,
                "capitalize",
                (item.resource_kind ?? "link") === rk ? PILL_ON : PILL_OFF,
              )}
            >
              {rk}
            </button>
          ))}
        </Field>
      )}

      {item.url && (
        <Field label="Source">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="truncate text-caption text-info hover:underline"
          >
            {item.url}
          </a>
        </Field>
      )}

      <Field label="Area">
        {AREA_OPTIONS.map((a) => (
          <button
            key={a.slug}
            type="button"
            onClick={() => pickArea(a.slug)}
            className={cn(
              PILL_BASE,
              "flex items-center gap-1.5",
              area === a.slug
                ? "border-transparent bg-muted text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent",
            )}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
            {a.label}
          </button>
        ))}
      </Field>

      {projectOptions && area && (
        <Field label="Project">
          {areaProjects.length === 0 ? (
            <span className="pt-1 text-caption text-muted-foreground/60">
              No projects in this area yet.
            </span>
          ) : (
            areaProjects.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => setProject(project === p.slug ? null : p.slug)}
                className={cn(
                  PILL_BASE,
                  project === p.slug ? "border-transparent bg-muted text-foreground" : PILL_OFF,
                )}
              >
                {p.title || p.slug}
              </button>
            ))
          )}
        </Field>
      )}

      {questOptions && area && (
        <Field label="Quest">
          {areaQuests.length === 0 ? (
            <span className="pt-1 text-caption text-muted-foreground/60">
              No quests in this area yet.
            </span>
          ) : (
            areaQuests.map((q) => (
              <button
                key={q.slug}
                type="button"
                onClick={() => setQuest(quest === q.slug ? null : q.slug)}
                className={cn(
                  PILL_BASE,
                  quest === q.slug ? "border-transparent bg-muted text-foreground" : PILL_OFF,
                )}
              >
                {q.title || q.slug}
              </button>
            ))
          )}
        </Field>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button
          size="sm"
          onClick={() =>
            onFile(item, {
              area: area ?? undefined,
              project: project ?? undefined,
              quest: quest ?? undefined,
            })
          }
        >
          {item.kind === "resource" ? (
            <Sparkles className="size-3.5" />
          ) : (
            <ListTodo className="size-3.5" />
          )}
          File to {item.kind === "resource" ? "Library" : "Tasks"}
          <ArrowRight className="size-3.5" />
        </Button>
        <button
          type="button"
          onClick={() => onDiscard(item)}
          className="flex items-center gap-1.5 text-caption text-error hover:underline"
        >
          <Trash2 className="size-3.5" />
          Discard
        </button>
      </div>
    </div>
  );
}
