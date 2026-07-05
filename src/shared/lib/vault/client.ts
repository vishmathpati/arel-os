/**
 * Frontend vault client — typed wrappers over the Bun vault server's HTTP
 * endpoints (server/index.ts). Browser-only (uses fetch). Base URL comes from
 * VAULT_API (build-time VITE_VAULT_API, see base-url.ts).
 */

import { VAULT_API as BASE_URL } from "./base-url";
import type { AnyFrontmatter, VaultDoc, VaultListEntry } from "./schemas";

/** A non-2xx response carries `{ error }` JSON; surface it as an Error. */
async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // non-JSON error body — keep the status line
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

const qs = (params: Record<string, string>): string => new URLSearchParams(params).toString();

/** GET /vault/read — full document (frontmatter + body). */
export async function readDoc(path: string): Promise<VaultDoc> {
  return unwrap(await fetch(`${BASE_URL}/vault/read?${qs({ path })}`));
}

/** GET /vault/frontmatter — frontmatter only. */
export async function readFrontmatter(
  path: string,
): Promise<{ path: string; frontmatter: AnyFrontmatter }> {
  return unwrap(await fetch(`${BASE_URL}/vault/frontmatter?${qs({ path })}`));
}

/** GET /vault/list — shallow listing of a vault directory. */
export async function listDir(dir: string): Promise<{ dir: string; entries: VaultListEntry[] }> {
  return unwrap(await fetch(`${BASE_URL}/vault/list?${qs({ dir })}`));
}

/** POST /vault/write — atomic write; returns the stamped frontmatter. */
export async function writeDoc(
  path: string,
  frontmatter: Record<string, unknown>,
  body = "",
): Promise<{ path: string; frontmatter: AnyFrontmatter }> {
  return unwrap(
    await fetch(`${BASE_URL}/vault/write`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, frontmatter, body }),
    }),
  );
}

/** POST /vault/delete — soft-delete; returns the archive path. */
export async function deleteDoc(
  path: string,
): Promise<{ archivedPath: string; deleted_from: string }> {
  return unwrap(
    await fetch(`${BASE_URL}/vault/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }),
  );
}
