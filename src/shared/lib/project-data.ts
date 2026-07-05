/**
 * Project data layer — CRUD over the vault, one folder per project
 * (`projects/<slug>/<slug>.md`, D19 folder-form so it can hold attachments).
 * Browser-only; reads fresh every call (no indexing). Body = the project's
 * editable description.
 *
 * Required at creation: title + area (the one-home anchor, D3). `kind` defaults
 * to `standard`. Quest / due / demoted are optional. Soft-delete only (D12).
 */

import { areaWikilink } from "@/shared/lib/areas";
import { deleteDoc, listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import { wikiTarget } from "@/shared/lib/vault/frontmatter";
import { projectPath, slugify } from "@/shared/lib/vault/paths";
import type { ProjectFrontmatter, ProjectKind, VaultDoc } from "@/shared/lib/vault/schemas";

/** An in-memory project: frontmatter flattened, plus path/slug/description. */
export interface Project extends ProjectFrontmatter {
  /** Relative vault path, e.g. "projects/redesign/redesign.md". */
  path: string;
  /** Filename stem. */
  slug: string;
  /** Markdown body = the editable description. */
  description: string;
}

export interface CreateProjectInput {
  title: string;
  /** Area slug (bare) — wrapped into a wikilink on write. */
  area: string;
  kind?: ProjectKind;
  quest?: string;
  due?: string;
}

function toProject(doc: VaultDoc<ProjectFrontmatter>): Project {
  const slug = doc.path.replace(/^projects\//, "").replace(/\/[^/]+\.md$/, "");
  return { ...doc.frontmatter, path: doc.path, slug, description: doc.body };
}

/** Strip the in-memory-only fields back to a plain frontmatter object. */
function frontmatterOf(project: Project): Record<string, unknown> {
  const { path: _p, slug: _s, description: _d, ...fm } = project;
  return fm;
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  const root = base || "project";
  if (!taken.has(root)) return root;
  let n = 2;
  while (taken.has(`${root}-${n}`)) n += 1;
  return `${root}-${n}`;
}

/** All current (non-deleted) projects, read fresh. */
export async function listProjects(): Promise<Project[]> {
  const { entries } = await listDir("projects");
  const dirs = entries.filter((e) => e.type === "dir");
  const docs = await Promise.all(
    dirs.map((e) => {
      const slug = e.path.split("/")[1];
      return readDoc(projectPath(slug)).catch(() => null);
    }),
  );
  return docs
    .filter((d): d is VaultDoc<ProjectFrontmatter> => d?.frontmatter?.type === "project")
    .filter((d) => !d.frontmatter.deleted)
    .map(toProject);
}

/** Projects whose one-home area matches `areaSlug`. */
export async function listProjectsByArea(areaSlug: string): Promise<Project[]> {
  const all = await listProjects();
  return all.filter((p) => wikiTarget(p.area) === areaSlug);
}

/** Read one project, or null if missing / not a project. */
export async function readProject(slug: string): Promise<Project | null> {
  try {
    const doc = (await readDoc(projectPath(slug))) as VaultDoc<ProjectFrontmatter>;
    if (doc.frontmatter?.type !== "project") return null;
    return toProject(doc);
  } catch {
    return null;
  }
}

/** Create a project (status defaults to backlog, kind to standard). */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { entries } = await listDir("projects");
  const taken = new Set(entries.filter((e) => e.type === "dir").map((e) => e.path.split("/")[1]));
  const slug = uniqueSlug(slugify(input.title), taken);

  const frontmatter: Record<string, unknown> = {
    type: "project",
    title: input.title,
    area: areaWikilink(input.area),
    status: "backlog",
    kind: input.kind ?? "standard",
  };
  if (input.quest) frontmatter.quest = input.quest;
  if (input.due) frontmatter.due = input.due;

  const res = await writeDoc(projectPath(slug), frontmatter, "");
  return toProject({
    path: res.path,
    frontmatter: res.frontmatter as ProjectFrontmatter,
    body: "",
  });
}

/** Patch a project's frontmatter (and optionally its description body). */
export async function updateProject(
  project: Project,
  patch: Partial<ProjectFrontmatter>,
  description: string = project.description,
): Promise<Project> {
  const frontmatter = { ...frontmatterOf(project), ...patch };
  for (const key of Object.keys(patch) as (keyof ProjectFrontmatter)[]) {
    if (patch[key] === undefined) delete frontmatter[key];
  }
  const res = await writeDoc(project.path, frontmatter, description);
  return toProject({
    path: project.path,
    frontmatter: res.frontmatter as ProjectFrontmatter,
    body: description,
  });
}

/** Soft-delete a project (moves it to archive/deleted/). */
export async function deleteProject(project: Project): Promise<void> {
  await deleteDoc(project.path);
}
