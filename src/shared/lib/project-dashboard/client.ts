/**
 * Frontend data layer for the software-project dashboard. The dashboard reads the
 * saved snapshot (system/project-snapshots/<slug>.md) — it never reads code and
 * never runs the AI. Repo linking + lazy file content go through the engine server.
 */

import { readDoc } from "@/shared/lib/vault/client";
import { projectSnapshotPath } from "@/shared/lib/vault/paths";
import { type ProjectSnapshot, parseSnapshot } from "./snapshot";

const BASE_URL = import.meta.env.VITE_VAULT_API ?? "http://localhost:5274";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep status line
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/**
 * Read a project's dashboard snapshot. Returns null when it hasn't been synced yet
 * (no file, or a placeholder body with no JSON) — the dashboard shows its empty state.
 */
export async function readSnapshot(slug: string): Promise<ProjectSnapshot | null> {
  try {
    const doc = await readDoc(projectSnapshotPath(slug));
    return parseSnapshot(doc.body);
  } catch {
    return null; // 404 → never synced
  }
}

/** Result of validating a pasted repo folder before linking it (GET /engine/repo-check). */
export interface RepoCheck {
  exists: boolean;
  protocolCount: number;
  name: string;
}

/** Validate a candidate repo folder the user pasted (folder exists + protocol-file count). */
export async function checkRepo(path: string): Promise<RepoCheck> {
  return unwrap(await fetch(`${BASE_URL}/engine/repo-check?path=${encodeURIComponent(path)}`));
}

/** Lazily fetch one protocol file's markdown for the Files tab (GET /engine/project-file). */
export async function readProjectFile(slug: string, path: string): Promise<string> {
  const data = await unwrap<{ path: string; content: string }>(
    await fetch(
      `${BASE_URL}/engine/project-file?slug=${encodeURIComponent(slug)}&path=${encodeURIComponent(path)}`,
    ),
  );
  return data.content;
}
