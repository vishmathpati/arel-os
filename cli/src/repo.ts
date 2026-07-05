/**
 * Getting the app source onto disk (spec §1 Step 8) and keeping it updated
 * (spec §2 rlo update). Supports a `--local-repo <path>` override for
 * development/dry-run testing so we never have to hit GitHub in tests.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { runCapture, runStreaming } from "./exec.js";

export const DEFAULT_REPO_URL = "https://github.com/vishmathpati/arel-os";
export const DEFAULT_BRANCH = "main";

export function isGitCheckout(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

/**
 * Get the app source into installDir. If installDir is already a git
 * checkout (existing install / repair), this is a no-op — caller should use
 * `pullLatest` instead. Otherwise clones fresh.
 *
 * `sourcePath` (the --local-repo override) copies a local working tree via
 * `git clone <local path>` instead of hitting GitHub — this keeps `git`
 * semantics (still a real .git checkout, `git pull` still works against the
 * local origin) while avoiding a network dependency in dev/dry-run.
 */
export async function cloneRepo(
  installDir: string,
  opts: { sourcePath?: string; repoUrl?: string; branch?: string } = {},
): Promise<{ code: number; stderr: string }> {
  const source = opts.sourcePath ?? opts.repoUrl ?? DEFAULT_REPO_URL;
  const args = ["clone", "--depth", "1", "--branch", opts.branch ?? DEFAULT_BRANCH, source, installDir];
  const res = await runStreaming("git", args);
  return { code: res.code, stderr: res.stderr };
}

export async function pullLatest(installDir: string): Promise<{ code: number; dirty: boolean; stderr: string }> {
  const statusRes = await runCapture("git", ["-C", installDir, "status", "--porcelain"]);
  const dirty = statusRes.stdout.trim().length > 0;
  if (dirty) {
    return { code: 1, dirty: true, stderr: "working tree has uncommitted changes" };
  }
  const res = await runStreaming("git", ["-C", installDir, "pull", "--ff-only"]);
  return { code: res.code, dirty: false, stderr: res.stderr };
}

export async function currentRevision(installDir: string): Promise<string | null> {
  const res = await runCapture("git", ["-C", installDir, "rev-parse", "--short", "HEAD"]);
  return res.code === 0 ? res.stdout.trim() : null;
}

/** Best-effort "is the local branch behind origin" check (spec §2 rlo status). */
export async function isBehindOrigin(installDir: string): Promise<boolean | null> {
  const fetchRes = await runCapture("git", ["-C", installDir, "fetch", "--dry-run"]);
  if (fetchRes.code !== 0) return null;
  const countRes = await runCapture("git", ["-C", installDir, "rev-list", "--count", "HEAD..@{u}"]);
  if (countRes.code !== 0) return null;
  const count = Number(countRes.stdout.trim());
  return Number.isFinite(count) ? count > 0 : null;
}
