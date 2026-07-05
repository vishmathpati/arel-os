/**
 * Global multi-install registry (~/.arelos/installs.json, or
 * ARELOS_REGISTRY_PATH override). Each entry records one named, self-contained
 * install so `arelos` can find/list/select among several installs on one Mac
 * without any of them clobbering a shared config file (0.2.0 mission).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { registryPath } from "./paths.js";

export interface RegistryEntry {
  name: string;
  slug: string;
  root: string;
  createdAt: string;
}

export function readRegistry(): RegistryEntry[] {
  const p = registryPath();
  if (!existsSync(p)) return [];
  const raw = JSON.parse(readFileSync(p, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(`Invalid registry at ${p}: expected an array`);
  }
  return raw as RegistryEntry[];
}

/** Atomic write: tmp file + rename, so a reader never sees a partial file. */
function writeRegistry(entries: RegistryEntry[]): void {
  const p = registryPath();
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, p);
}

/** Append (or replace, by matching root) an entry — a reinstall at the same root updates it in place. */
export function addRegistryEntry(entry: RegistryEntry): void {
  const entries = readRegistry().filter((e) => e.root !== entry.root);
  entries.push(entry);
  writeRegistry(entries);
}

/** Remove the entry for a given root (uninstall). No-op if absent. */
export function removeRegistryEntry(root: string): void {
  const entries = readRegistry().filter((e) => e.root !== root);
  writeRegistry(entries);
}

export function findRegistryEntryByName(name: string): RegistryEntry | null {
  return readRegistry().find((e) => e.name === name || e.slug === name) ?? null;
}
