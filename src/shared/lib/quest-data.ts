/**
 * Quest data layer — CRUD over the vault, one folder per quest
 * (`quests/<slug>/<slug>.md`, D19 folder-form). Browser-only; reads fresh.
 * Body = the quest's notes (Plate placeholder per D29).
 *
 * Required at creation: title + area + deadline (D2 — a quest is a goal with a
 * deadline). Milestones are an inline frontmatter array (D20). Soft-delete only.
 *
 * Re-homing (D30): when a quest ends (done/dropped), its unfinished projects
 * demote — `quest` cleared, `demoted: true`, area unchanged. The Weekly-Review
 * queue that surfaces them is Ch13; only the demotion action lives here.
 */

import { areaWikilink } from "@/shared/lib/areas";
import { type Project, listProjects, updateProject } from "@/shared/lib/project-data";
import { isProjectFinished } from "@/shared/lib/projects";
import { isQuestFinished } from "@/shared/lib/quests";
import { deleteDoc, listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import { questPath, slugify } from "@/shared/lib/vault/paths";
import type {
  Milestone,
  QuestFrontmatter,
  QuestStatus,
  VaultDoc,
} from "@/shared/lib/vault/schemas";

/** An in-memory quest: frontmatter flattened, plus path/slug/notes. */
export interface Quest extends QuestFrontmatter {
  path: string;
  slug: string;
  /** Markdown body = notes. */
  notes: string;
}

export interface CreateQuestInput {
  title: string;
  /** Area slug (bare) — wrapped into a wikilink on write. */
  area: string;
  /** Required deadline (date or datetime). */
  deadline: string;
  target?: string;
}

function toQuest(doc: VaultDoc<QuestFrontmatter>): Quest {
  const slug = doc.path.replace(/^quests\//, "").replace(/\/[^/]+\.md$/, "");
  return { ...doc.frontmatter, path: doc.path, slug, notes: doc.body };
}

function frontmatterOf(quest: Quest): Record<string, unknown> {
  const { path: _p, slug: _s, notes: _n, ...fm } = quest;
  return fm;
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "quest";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/** All current (non-deleted) quests, read fresh. */
export async function listQuests(): Promise<Quest[]> {
  const { entries } = await listDir("quests");
  const dirs = entries.filter((e) => e.type === "dir");
  const docs = await Promise.all(
    dirs.map((e) => {
      const slug = e.path.split("/")[1];
      return readDoc(questPath(slug)).catch(() => null);
    }),
  );
  return docs
    .filter((d): d is VaultDoc<QuestFrontmatter> => d?.frontmatter?.type === "quest")
    .filter((d) => !d.frontmatter.deleted)
    .map(toQuest);
}

/** Quests whose one-home area matches `areaSlug`. */
export async function listQuestsByArea(areaSlug: string): Promise<Quest[]> {
  const all = await listQuests();
  return all.filter((q) => wikiTarget(q.area) === areaSlug);
}

/** Read one quest, or null if missing / not a quest. */
export async function readQuest(slug: string): Promise<Quest | null> {
  try {
    const doc = (await readDoc(questPath(slug))) as VaultDoc<QuestFrontmatter>;
    if (doc.frontmatter?.type !== "quest") return null;
    return toQuest(doc);
  } catch {
    return null;
  }
}

/** Create a quest (status defaults to planned). */
export async function createQuest(input: CreateQuestInput): Promise<Quest> {
  const { entries } = await listDir("quests");
  const taken = new Set(entries.filter((e) => e.type === "dir").map((e) => e.path.split("/")[1]));
  const slug = uniqueSlug(slugify(input.title), taken);

  const frontmatter: Record<string, unknown> = {
    type: "quest",
    title: input.title,
    area: areaWikilink(input.area),
    status: "planned",
    deadline: input.deadline,
  };
  if (input.target) frontmatter.target = input.target;

  const res = await writeDoc(questPath(slug), frontmatter, "");
  return toQuest({ path: res.path, frontmatter: res.frontmatter as QuestFrontmatter, body: "" });
}

/** Patch a quest's frontmatter (and optionally its notes body). */
export async function updateQuest(
  quest: Quest,
  patch: Partial<QuestFrontmatter>,
  notes: string = quest.notes,
): Promise<Quest> {
  const frontmatter = { ...frontmatterOf(quest), ...patch };
  for (const key of Object.keys(patch) as (keyof QuestFrontmatter)[]) {
    if (patch[key] === undefined) delete frontmatter[key];
  }
  const res = await writeDoc(quest.path, frontmatter, notes);
  return toQuest({
    path: quest.path,
    frontmatter: res.frontmatter as QuestFrontmatter,
    body: notes,
  });
}

/**
 * Set a quest's status. Ending it (done/dropped) demotes its unfinished
 * projects (D30). Returns the updated quest plus the count demoted.
 */
export async function setQuestStatus(
  quest: Quest,
  status: QuestStatus,
): Promise<{ quest: Quest; demoted: number }> {
  const updated = await updateQuest(quest, { status });
  let demoted = 0;
  if (isQuestFinished(status) && !isQuestFinished(quest.status)) {
    demoted = await demoteProjectsOfQuest(quest.slug);
  }
  return { quest: updated, demoted };
}

/** Roll a quest over to a new deadline (re-activates it). */
export async function rollOverQuest(quest: Quest, newDeadline: string): Promise<Quest> {
  return updateQuest(quest, { deadline: newDeadline, status: "active" });
}

/** Demote every unfinished project under a quest: clear quest, flag demoted. */
export async function demoteProjectsOfQuest(questSlug: string): Promise<number> {
  const projects = await listProjects();
  const toDemote = projects.filter(
    (p: Project) => p.quest && wikiTarget(p.quest) === questSlug && !isProjectFinished(p.status),
  );
  await Promise.all(toDemote.map((p) => updateProject(p, { quest: undefined, demoted: true })));
  return toDemote.length;
}

// ── Milestones (inline frontmatter array, D20) ───────────────────────────────

export async function addMilestone(quest: Quest, title: string): Promise<Quest> {
  const milestones = [...(quest.milestones ?? []), { title, reached: false }];
  return updateQuest(quest, { milestones });
}

export async function toggleMilestone(
  quest: Quest,
  index: number,
  now: string = new Date().toISOString(),
): Promise<Quest> {
  const milestones = (quest.milestones ?? []).map((m, i): Milestone => {
    if (i !== index) return m;
    const reached = !m.reached;
    return { title: m.title, reached, ...(reached ? { reached_at: now } : {}) };
  });
  return updateQuest(quest, { milestones });
}

export async function removeMilestone(quest: Quest, index: number): Promise<Quest> {
  const milestones = (quest.milestones ?? []).filter((_, i) => i !== index);
  return updateQuest(quest, { milestones });
}

/** Soft-delete a quest (moves it to archive/deleted/). */
export async function deleteQuest(quest: Quest): Promise<void> {
  await deleteDoc(quest.path);
}
