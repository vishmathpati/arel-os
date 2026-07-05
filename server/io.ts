/**
 * Vault file I/O — the server-only layer that reads and writes the markdown
 * vault. Uses node:fs; never imported by the browser bundle. All path inputs
 * are RELATIVE to the vault root and resolved through resolveVaultPath, which
 * guards against traversal outside the vault.
 *
 * Writes are atomic: temp file → fsync → rename (Contract). Deletes are soft:
 * the file moves to archive/deleted/<original> with `deleted` + `deleted_from`
 * markers (BRIEF D12).
 */

import { promises as fs } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import {
  parseDocument,
  serializeDocument,
  wikiTarget,
} from "../src/shared/lib/vault/frontmatter.ts";
import { VAULT_DIRS, archivedPath, mediaPath } from "../src/shared/lib/vault/paths.ts";
import type { AnyFrontmatter, VaultDoc, VaultListEntry } from "../src/shared/lib/vault/schemas.ts";
import { loadConfig } from "./config.ts";

/** The real vault root, resolved from `~/.arelos/config.json` (or dev fallback). */
const CONFIGURED_ROOT = loadConfig().vaultPath;

/** Thrown when a relative path would escape the vault root. */
export class VaultPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultPathError";
  }
}

/** Thrown when a requested vault file does not exist. */
export class VaultNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultNotFoundError";
  }
}

/**
 * Resolve a vault-relative path to an absolute path, refusing anything that
 * escapes the root (e.g. "../etc/passwd"). `root` is injectable for tests.
 */
export function resolveVaultPath(relativePath: string, root: string = CONFIGURED_ROOT): string {
  const rootAbs = resolve(root);
  const abs = resolve(rootAbs, relativePath);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + sep)) {
    throw new VaultPathError(`Path escapes vault: ${relativePath}`);
  }
  return abs;
}

function isENOENT(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT";
}

/** Atomic write: write to a temp sibling, fsync, then rename into place. */
async function atomicWrite(absPath: string, contents: string): Promise<void> {
  await fs.mkdir(dirname(absPath), { recursive: true });
  const tmp = `${absPath}.tmp-${process.pid}-${Date.now()}`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(contents);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, absPath);
  } catch (err) {
    await fs.rm(tmp, { force: true });
    throw err;
  }
}

/** Read and parse a vault file into { path, frontmatter, body }. */
export async function readVaultFile(
  relativePath: string,
  root: string = CONFIGURED_ROOT,
): Promise<VaultDoc> {
  const abs = resolveVaultPath(relativePath, root);
  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch (err) {
    if (isENOENT(err)) {
      throw new VaultNotFoundError(`No vault file at: ${relativePath}`);
    }
    throw err;
  }
  const { frontmatter, body } = parseDocument(raw);
  return {
    path: relativePath,
    frontmatter: frontmatter as unknown as AnyFrontmatter,
    body,
  };
}

/** Read only the frontmatter of a vault file (body is parsed but discarded). */
export async function readFrontmatter(
  relativePath: string,
  root: string = CONFIGURED_ROOT,
): Promise<{ path: string; frontmatter: AnyFrontmatter }> {
  const doc = await readVaultFile(relativePath, root);
  return { path: doc.path, frontmatter: doc.frontmatter };
}

/**
 * Write a vault file atomically. Stamps `updated` (and `created` when absent)
 * so every record carries timestamps without the caller managing them. Returns
 * the stamped frontmatter.
 */
export async function writeVaultFile(
  relativePath: string,
  frontmatter: Record<string, unknown>,
  body: string,
  root: string = CONFIGURED_ROOT,
): Promise<{ path: string; frontmatter: AnyFrontmatter }> {
  const abs = resolveVaultPath(relativePath, root);
  const now = new Date().toISOString();
  const stamped: Record<string, unknown> = { ...frontmatter };
  if (!stamped.created) stamped.created = now;
  stamped.updated = now;
  await atomicWrite(abs, serializeDocument(stamped, body));
  return { path: relativePath, frontmatter: stamped as unknown as AnyFrontmatter };
}

/**
 * Soft-delete (D12): move the file to archive/deleted/<original-path>, adding
 * `deleted: true` and `deleted_from: <original-path>` to its frontmatter, then
 * remove the original. Returns the new archive path.
 */
export async function softDeleteVaultFile(
  relativePath: string,
  root: string = CONFIGURED_ROOT,
): Promise<{ archivedPath: string; deleted_from: string }> {
  const abs = resolveVaultPath(relativePath, root);
  const doc = await readVaultFile(relativePath, root);
  const dest = archivedPath(relativePath);
  const destAbs = resolveVaultPath(dest, root);
  const frontmatter: Record<string, unknown> = {
    ...doc.frontmatter,
    deleted: true,
    deleted_from: relativePath,
  };
  await atomicWrite(destAbs, serializeDocument(frontmatter, doc.body));
  await fs.unlink(abs);
  return { archivedPath: dest, deleted_from: relativePath };
}

/**
 * Shallow directory listing relative to the vault root. Returns `.md` files and
 * subdirectories (so containers like projects/ can be walked). Missing dirs
 * yield an empty list rather than throwing.
 */
export async function listVaultDir(
  relativeDir: string,
  root: string = CONFIGURED_ROOT,
): Promise<VaultListEntry[]> {
  const abs = resolveVaultPath(relativeDir, root);
  const entries: VaultListEntry[] = [];
  try {
    const dirents = await fs.readdir(abs, { withFileTypes: true });
    for (const dirent of dirents) {
      const name = String(dirent.name);
      const rel = relativeDir ? `${relativeDir}/${name}` : name;
      if (dirent.isDirectory()) {
        entries.push({ path: rel, type: "dir" });
      } else if (dirent.isFile() && name.endsWith(".md")) {
        entries.push({ path: rel, type: "file" });
      }
    }
  } catch (err) {
    if (isENOENT(err)) return [];
    throw err;
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return entries;
}

/** The flat type-folders a bare `[[stem]]` may resolve into, basename-matched. */
const RESOLVE_DIRS: readonly string[] = [
  VAULT_DIRS.tasks,
  VAULT_DIRS.pages,
  VAULT_DIRS.projects,
  VAULT_DIRS.quests,
  VAULT_DIRS.areas,
  VAULT_DIRS.databases,
  VAULT_DIRS.inbox,
];

/**
 * Resolve a wikilink ([[stem]] or a bare stem) to a vault-relative path by
 * basename. Container folders (projects/quests/areas/databases) are searched
 * one level deep for `<stem>/<stem>.md` or `<stem>/_index.md`. Returns null if
 * no match is found.
 */
export async function resolveWikilink(
  link: string,
  root: string = CONFIGURED_ROOT,
): Promise<string | null> {
  const stem = wikiTarget(link);
  if (!stem) return null;

  for (const dir of RESOLVE_DIRS) {
    // Flat leaf: <dir>/<stem>.md
    const flat = `${dir}/${stem}.md`;
    if (await exists(resolveVaultPath(flat, root))) return flat;

    // Folder-form container: <dir>/<stem>/<stem>.md or <dir>/<stem>/_index.md
    for (const leaf of [`${stem}.md`, "_index.md"]) {
      const nested = `${dir}/${stem}/${leaf}`;
      if (await exists(resolveVaultPath(nested, root))) return nested;
    }
  }
  return null;
}

async function exists(absPath: string): Promise<boolean> {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

/** Absolute path on disk for a vault-relative path (handy for tests/tools). */
export function absVaultPath(relativePath: string, root: string = CONFIGURED_ROOT): string {
  return join(resolve(root), relativePath);
}

/**
 * Save an uploaded media file into `media/`. The filename stem is slugified and
 * the extension preserved; collisions get a numeric suffix. Returns the
 * vault-relative path so the server can build a serve URL.
 */
export async function saveMediaFile(
  originalName: string,
  bytes: Uint8Array,
  root: string = CONFIGURED_ROOT,
): Promise<{ relativePath: string; filename: string }> {
  const dot = originalName.lastIndexOf(".");
  const ext =
    dot > 0
      ? originalName
          .slice(dot)
          .toLowerCase()
          .replace(/[^a-z0-9.]/g, "")
      : "";
  const stem =
    (dot > 0 ? originalName.slice(0, dot) : originalName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "file";

  let name = `${stem}${ext}`;
  let n = 2;
  while (await exists(resolveVaultPath(mediaPath(name), root))) {
    name = `${stem}-${n}${ext}`;
    n += 1;
  }

  const abs = resolveVaultPath(mediaPath(name), root);
  await fs.mkdir(dirname(abs), { recursive: true });
  await fs.writeFile(abs, bytes);
  return { relativePath: mediaPath(name), filename: name };
}
