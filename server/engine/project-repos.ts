/**
 * The repo allowlist — the live set of folders the project-read / design-tokens
 * tools (and the project-file endpoint) are permitted to touch. It is sourced
 * from vault DATA, not hard-coded: a folder is allowed iff some `kind: software`
 * project carries it as `repo_path`. Same safety shape as web-fetch's host
 * allowlist and gws's fixed binary — a recipe can only read folders the user has
 * deliberately linked to a project (D64).
 */

import { resolve } from "node:path";
import { VAULT_DIRS, projectPath } from "../../src/shared/lib/vault/paths.ts";
import type { ProjectFrontmatter } from "../../src/shared/lib/vault/schemas.ts";
import { listVaultDir, readVaultFile } from "../io.ts";

export interface SoftwareProject {
  slug: string;
  title: string;
  repoPath: string;
}

/** Canonicalize an absolute path for set-membership comparison (no trailing slash). */
export function normalizeRepoPath(p: string): string {
  return resolve(p.trim());
}

/**
 * Every `kind: software` project that has a linked `repo_path`, read from the
 * vault's projects/ folder. Soft-deleted projects are skipped. Unreadable rows
 * are skipped rather than throwing — one bad file can't break a whole sync.
 */
export async function listSoftwareProjects(): Promise<SoftwareProject[]> {
  const entries = await listVaultDir(VAULT_DIRS.projects);
  const out: SoftwareProject[] = [];
  for (const entry of entries) {
    if (entry.type !== "dir") continue;
    const slug = entry.path.split("/").pop() ?? entry.path;
    try {
      const doc = await readVaultFile(projectPath(slug));
      const fm = doc.frontmatter as unknown as ProjectFrontmatter;
      const repo = typeof fm.repo_path === "string" ? fm.repo_path.trim() : "";
      if (fm.kind === "software" && repo && !fm.deleted) {
        out.push({ slug, title: typeof fm.title === "string" ? fm.title : slug, repoPath: repo });
      }
    } catch {
      // skip unreadable / malformed project files
    }
  }
  return out;
}

/** The allowlist as a normalized Set, for O(1) membership checks in the tools. */
export async function listSoftwareRepoPaths(): Promise<Set<string>> {
  const projects = await listSoftwareProjects();
  return new Set(projects.map((p) => normalizeRepoPath(p.repoPath)));
}

/** True iff `repoPath` is one of the linked software-project folders. */
export async function isAllowedRepoPath(repoPath: string): Promise<boolean> {
  const allow = await listSoftwareRepoPaths();
  return allow.has(normalizeRepoPath(repoPath));
}

/** Resolve a project slug to its linked repo path (null if not a linked software project). */
export async function repoPathForSlug(slug: string): Promise<string | null> {
  const projects = await listSoftwareProjects();
  return projects.find((p) => p.slug === slug)?.repoPath ?? null;
}
