/**
 * Step 4b — 2-3 Tasks (real creation, spec §3 Step 4b). Mirrors the tasks-page
 * quick-add pattern: type, hit enter, repeat — same `useTasks().create({
 * title, schedule: "today" })` call. Requires ≥1 task to advance; 2-3
 * encouraged via a quiet nudge. Tasks attach to the project/quest/area chain
 * being built when available, standalone otherwise.
 */

import { useTasks } from "@/app/tasks/use-tasks";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import type { Project } from "@/shared/lib/project-data";
import type { Quest } from "@/shared/lib/quest-data";
import { toWikilink } from "@/shared/lib/vault/frontmatter";
import { Check } from "lucide-react";
import { useRef, useState } from "react";

export function StepTasks({
  quest,
  project,
  onNext,
}: {
  quest: Quest | null;
  project: Project | null;
  onNext: (count: number) => void;
}) {
  const { create } = useTasks();
  const [titles, setTitles] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    const task = await create({
      title,
      schedule: "today",
      ...(project ? { project: toWikilink(project.slug) } : {}),
      ...(quest && !project ? { quest: toWikilink(quest.slug) } : {}),
    });
    if (task) setTitles((prev) => [...prev, title]);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-heading font-semibold">A Task is one action, one sitting.</h1>
        <p className="text-body text-muted-foreground">
          Tasks are the smallest unit — one thing you can knock out without stopping. Add two or
          three real ones{project ? ` for "${project.title}"` : ""}. Type, hit enter, repeat.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-center gap-2"
      >
        <Input
          ref={inputRef}
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Book the dentist"
        />
        <Button type="submit" disabled={!draft.trim()}>
          Add
        </Button>
      </form>

      {titles.length > 0 && (
        <ul className="space-y-1.5">
          {titles.map((t, i) => (
            <li
              key={`${t}-${
                // biome-ignore lint/suspicious/noArrayIndexKey: display-only log of created tasks, never reordered
                i
              }`}
              className="flex items-center gap-2 text-body"
            >
              <Check className="size-4 text-success" />
              {t}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={() => onNext(titles.length)} disabled={titles.length === 0}>
          I've added my tasks →
        </Button>
        {titles.length === 1 && (
          <span className="text-caption text-muted-foreground">
            Add another? Two or three is ideal.
          </span>
        )}
      </div>
    </div>
  );
}
