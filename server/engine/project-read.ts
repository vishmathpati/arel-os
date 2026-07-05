/**
 * Protocol reader — the deterministic half of project-sync. Given a linked repo
 * folder, it reads a FIXED allowlist of project-protocol markdown files (root +
 * agents/ + docs/INDEX.md), fingerprints each (sha256 + mtime + bytes), and — given
 * the prior run's manifest — reports whether anything changed. NO recursive walk,
 * NO code files: the only things ever read are the named protocol docs, honoring
 * "never read code" (D63). The CSS/DESIGN.md design extraction is a separate tool
 * (design-tokens.ts).
 *
 * Change detection is all-or-nothing by design: if nothing changed the recipe
 * skips the model entirely; if anything changed the model re-synthesizes the whole
 * snapshot (overview/roadmap/decisions read across all docs, so it needs them all).
 */

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type {
  FileCategory,
  ManifestEntry,
} from "../../src/shared/lib/project-dashboard/snapshot.ts";

/** One protocol document: where to find it (first existing candidate wins) + how to label it. */
interface ProtocolSpec {
  /** Candidate repo-relative paths in priority order (agents/ usually beats root). */
  candidates: string[];
  title: string;
  category: FileCategory;
}

/**
 * The fixed protocol allowlist. Each entry resolves to the first candidate that
 * exists in the repo. This is the ONLY set of files project-read ever touches.
 */
const PROTOCOL_SPECS: ProtocolSpec[] = [
  { candidates: ["CLAUDE.md"], title: "Claude", category: "claude" },
  { candidates: ["agents/STATUS.md", "STATUS.md"], title: "Status", category: "status" },
  { candidates: ["agents/BRIEF.md", "BRIEF.md"], title: "Brief", category: "brief" },
  { candidates: ["agents/BRIEF-2.md"], title: "Brief (cont.)", category: "brief" },
  { candidates: ["agents/ROADMAP.md", "ROADMAP.md"], title: "Roadmap", category: "roadmap" },
  {
    candidates: ["agents/CHANGELOG.md", "CHANGELOG.md"],
    title: "Changelog",
    category: "changelog",
  },
  { candidates: ["agents/WORKLOG.md", "WORKLOG.md"], title: "Worklog", category: "worklog" },
  { candidates: ["agents/DESIGN.md", "DESIGN.md"], title: "Design", category: "design" },
  {
    candidates: ["agents/DISCOVERIES.md", "DISCOVERIES.md"],
    title: "Discoveries",
    category: "discoveries",
  },
  {
    candidates: ["agents/FUNDAMENTALS.md", "FUNDAMENTALS.md"],
    title: "Fundamentals",
    category: "fundamentals",
  },
  { candidates: ["agents/BRAND.md", "BRAND.md"], title: "Brand", category: "brand" },
  { candidates: ["docs/INDEX.md", "agents/docs/INDEX.md"], title: "Index", category: "index" },
];

/** The complete set of repo-relative paths project-read may ever read (for endpoint guards). */
export const PROTOCOL_PATHS: ReadonlySet<string> = new Set(
  PROTOCOL_SPECS.flatMap((s) => s.candidates),
);

/** File metadata shown in the Files-tab list (content is lazy-loaded separately). */
export interface ProtocolFileMeta {
  path: string;
  title: string;
  category: FileCategory;
  bytes: number;
  lines: number;
}

/** A protocol file plus its full markdown — what the model reasons over on a changed run. */
export interface ProtocolFile extends ProtocolFileMeta {
  content: string;
}

export interface ProjectReadResult {
  /** "folder-missing" ⇒ the linked folder moved/renamed (recipe should write a relink task). */
  status: "ok" | "folder-missing";
  /** true ⇒ nothing changed vs the prior manifest; the recipe can skip the model. */
  unchanged: boolean;
  /** Current fingerprint of every found protocol file. */
  manifest: ManifestEntry[];
  /** List metadata for every found file (no content). */
  files: ProtocolFileMeta[];
  /** Repo-relative paths that changed (added/edited/removed) vs the prior manifest. */
  changed: string[];
  /** Full content of every found file — fed to the model only when `unchanged` is false. */
  contents: ProtocolFile[];
}

async function pathExists(abs: string): Promise<boolean> {
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Resolve a spec to its first existing candidate path (repo-relative), or null. */
async function resolveSpec(repoPath: string, spec: ProtocolSpec): Promise<string | null> {
  for (const rel of spec.candidates) {
    if (await pathExists(join(repoPath, rel))) return rel;
  }
  return null;
}

/**
 * Read one allowlisted protocol file's content. `rel` MUST be one of
 * PROTOCOL_PATHS (callers guard this) — there is no arbitrary-path read here.
 * Returns null if the file is gone.
 */
export async function readProtocolFileContent(
  repoPath: string,
  rel: string,
): Promise<string | null> {
  try {
    return await fs.readFile(join(repoPath, rel), "utf8");
  } catch {
    return null;
  }
}

/**
 * Read the fixed protocol set under `repoPath`, fingerprint it, and diff against
 * `priorManifest`. The repo folder itself is assumed already allowlist-validated
 * by the caller (the tool / endpoint).
 */
export async function readProtocol(
  repoPath: string,
  priorManifest?: ManifestEntry[],
): Promise<ProjectReadResult> {
  // Folder gone → the link is stale.
  let isDir = false;
  try {
    isDir = (await fs.stat(repoPath)).isDirectory();
  } catch {
    isDir = false;
  }
  if (!isDir) {
    return {
      status: "folder-missing",
      unchanged: false,
      manifest: [],
      files: [],
      changed: [],
      contents: [],
    };
  }

  const manifest: ManifestEntry[] = [];
  const files: ProtocolFileMeta[] = [];
  const contents: ProtocolFile[] = [];

  for (const spec of PROTOCOL_SPECS) {
    const rel = await resolveSpec(repoPath, spec);
    if (!rel) continue;
    const abs = join(repoPath, rel);
    let content: string;
    let mtime: string;
    let bytes: number;
    try {
      const [raw, stat] = await Promise.all([fs.readFile(abs, "utf8"), fs.stat(abs)]);
      content = raw;
      mtime = stat.mtime.toISOString();
      bytes = stat.size;
    } catch {
      continue; // disappeared between resolve and read
    }
    const lines = content.length === 0 ? 0 : content.split("\n").length;
    manifest.push({ path: rel, sha256: sha256(content), mtime, bytes });
    files.push({ path: rel, title: spec.title, category: spec.category, bytes, lines });
    contents.push({ path: rel, title: spec.title, category: spec.category, bytes, lines, content });
  }

  // Diff against the prior manifest by sha256 (paths added, edited, or removed).
  const priorByPath = new Map((priorManifest ?? []).map((m) => [m.path, m.sha256]));
  const nowByPath = new Map(manifest.map((m) => [m.path, m.sha256]));
  const changed: string[] = [];
  for (const m of manifest) {
    if (priorByPath.get(m.path) !== m.sha256) changed.push(m.path);
  }
  for (const [path] of priorByPath) {
    if (!nowByPath.has(path)) changed.push(path); // removed
  }

  const unchanged = priorManifest !== undefined && changed.length === 0;
  return { status: "ok", unchanged, manifest, files, changed, contents };
}
