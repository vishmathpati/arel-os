/**
 * Task data layer — CRUD over the Chapter 2 vault client. Reads/writes one
 * markdown file per task under `tasks/`. Browser-only (the client uses fetch).
 * No indexing/caching: every list reads the files fresh (D: no premature infra).
 *
 * The file path (slug) is fixed at creation; later title edits change only
 * frontmatter, never the filename — keeps identifiers and any wikilinks stable.
 */

import { deleteDoc, listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import { slugify, taskPath } from "@/shared/lib/vault/paths";
import type { TaskFrontmatter, TaskSchedule, VaultDoc } from "@/shared/lib/vault/schemas";
import { advanceSchedule } from "./schedule";

/** An in-memory task: its frontmatter, flattened, plus path/slug/body. */
export interface Task extends TaskFrontmatter {
  /** Relative vault path, e.g. "tasks/buy-milk.md". */
  path: string;
  /** Filename stem. */
  slug: string;
  /** Markdown body (notes). */
  body: string;
}

export interface CreateTaskInput {
  title: string;
  schedule: TaskSchedule;
  area?: string;
  project?: string;
  quest?: string;
}

function toTask(doc: VaultDoc<TaskFrontmatter>): Task {
  const slug = doc.path.replace(/^tasks\//, "").replace(/\.md$/, "");
  return { ...doc.frontmatter, path: doc.path, slug, body: doc.body };
}

/** Strip the in-memory-only fields back to a plain frontmatter object. */
function frontmatterOf(task: Task): Record<string, unknown> {
  const { path: _p, slug: _s, body: _b, ...fm } = task;
  return fm;
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "task";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/**
 * All current (non-deleted) tasks, read fresh from the vault.
 *
 * Habits (`habit: true`) are EXCLUDED: although a habit is technically a
 * recurring task, it is managed only on the Habits page and must never appear
 * in any work view (Today / This Week / Tasks / rituals / area sections). The
 * Habits page reads via `listHabits()`, which is independent of this function.
 */
export async function listTasks(): Promise<Task[]> {
  const { entries } = await listDir("tasks");
  const files = entries.filter((e) => e.type === "file");
  const docs = await Promise.all(files.map((e) => readDoc(e.path)));
  return docs
    .map((doc) => doc as VaultDoc<TaskFrontmatter>)
    .filter(
      (doc) =>
        doc.frontmatter?.type === "task" && !doc.frontmatter.deleted && !doc.frontmatter.habit,
    )
    .map(toTask);
}

/** Create a task with three-axis defaults; returns the persisted task. */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { entries } = await listDir("tasks");
  const taken = new Set(
    entries
      .filter((e) => e.type === "file")
      .map((e) => e.path.replace(/^tasks\//, "").replace(/\.md$/, "")),
  );
  const slug = uniqueSlug(slugify(input.title), taken);

  const frontmatter: Record<string, unknown> = {
    type: "task",
    title: input.title,
    status: "open",
    schedule: input.schedule,
    repeat: "none",
    notify: false,
  };
  if (input.area) frontmatter.area = input.area;
  if (input.project) frontmatter.project = input.project;
  if (input.quest) frontmatter.quest = input.quest;

  const res = await writeDoc(taskPath(slug), frontmatter, "");
  return toTask({ path: res.path, frontmatter: res.frontmatter as TaskFrontmatter, body: "" });
}

/** Patch a task's frontmatter (and optionally its body); returns the result. */
export async function updateTask(
  task: Task,
  patch: Partial<TaskFrontmatter>,
  body: string = task.body,
): Promise<Task> {
  const frontmatter = { ...frontmatterOf(task), ...patch };
  // Drop keys explicitly set to undefined so they don't serialize as `null`.
  for (const key of Object.keys(patch) as (keyof TaskFrontmatter)[]) {
    if (patch[key] === undefined) delete frontmatter[key];
  }
  const res = await writeDoc(task.path, frontmatter, body);
  return toTask({ path: task.path, frontmatter: res.frontmatter as TaskFrontmatter, body });
}

/**
 * Mark a task done. Stamps `completed`. If it recurs, generates the next
 * instance (fresh open task at the advanced date). Returns the completed task
 * plus any generated next task.
 */
export async function completeTask(
  task: Task,
  now: Date = new Date(),
): Promise<{ updated: Task; next: Task | null }> {
  const updated = await updateTask(task, {
    status: "done",
    completed: now.toISOString(),
  });

  // Habits are recurring tasks, but they track per-day completion via their
  // `completions[]` log on the Habits page — they must NEVER spawn a plain
  // recurring task instance (which would lose the habit identity and leak into
  // task views). So skip regeneration for habits.
  if (task.repeat && task.repeat !== "none" && !task.habit) {
    const nextSchedule = advanceSchedule(task.schedule, task.repeat, task.repeat_interval, now);
    const next = await createNext(task, nextSchedule);
    return { updated, next };
  }
  return { updated, next: null };
}

/** Re-open a completed task (clears the completed stamp). */
export async function reopenTask(task: Task): Promise<Task> {
  return updateTask(task, { status: "open", completed: undefined });
}

/** Soft-delete a task (moves it to archive/deleted/). */
export async function deleteTask(task: Task): Promise<void> {
  await deleteDoc(task.path);
}

/** Spawn the next recurrence instance, carrying context but resetting state. */
async function createNext(task: Task, schedule: TaskSchedule): Promise<Task> {
  const next = await createTask({
    title: task.title ?? "Untitled",
    schedule,
    area: task.area,
    project: task.project,
    quest: task.quest,
  });
  // Carry the recurrence rule + reminder settings onto the new instance.
  const patch: Partial<TaskFrontmatter> = {
    repeat: task.repeat,
    notify: task.notify,
  };
  if (task.repeat_interval !== undefined) patch.repeat_interval = task.repeat_interval;
  if (task.notify_lead !== undefined) patch.notify_lead = task.notify_lead;
  if (task.reminder_only !== undefined) patch.reminder_only = task.reminder_only;
  if (task.steps?.length) {
    patch.steps = task.steps.map((s) => ({ title: s.title, done: false }));
  }
  return updateTask(next, patch);
}
