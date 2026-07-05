/**
 * Shared "which install does this command target" resolution for
 * status/update/logs/uninstall (0.2.0 multi-install support).
 *
 * Rule: no name arg + exactly one known install -> that one. No name arg +
 * multiple installs -> interactive select (or, non-interactively, an error
 * listing the options). A name arg always resolves by exact registry
 * name/slug match. "Known installs" = registry entries, plus the legacy
 * fixed ~/.arelos/config.json as an "(unnamed)" install when present and not
 * already superseded by a registry entry at the same root.
 */
import * as p from "@clack/prompts";
import { readConfigAt, readConfig, type ArelConfig } from "./config.js";
import { legacyConfigPath } from "./paths.js";
import { existsSync } from "node:fs";
import { readRegistry, type RegistryEntry } from "./registry.js";

export interface ResolvedInstall {
  name: string;
  root: string | null; // null for the legacy unnamed install (no root concept)
  config: ArelConfig;
}

interface Candidate {
  name: string;
  root: string | null;
}

function listCandidates(): Candidate[] {
  const entries = readRegistry();
  const candidates: Candidate[] = entries.map((e) => ({ name: e.name, root: e.root }));
  if (existsSync(legacyConfigPath())) {
    candidates.push({ name: "(unnamed — legacy install)", root: null });
  }
  return candidates;
}

function loadCandidate(candidate: Candidate): ResolvedInstall | null {
  const config = candidate.root ? readConfigAt(candidate.root) : readConfig();
  if (!config) return null;
  return { name: candidate.name, root: candidate.root, config };
}

export interface ResolveOptions {
  /** Explicit name/slug argument the user passed, if any. */
  name?: string | null;
  /** Non-interactive contexts (e.g. no TTY, or an explicit --yes-like flag) must error instead of prompting. */
  interactive: boolean;
}

export type ResolveResult =
  | { ok: true; install: ResolvedInstall }
  | { ok: false; message: string };

/** Resolve which install a status/update/logs/uninstall invocation targets. */
export async function resolveInstall(opts: ResolveOptions): Promise<ResolveResult> {
  const candidates = listCandidates();

  if (opts.name) {
    const match = candidates.find((c) => c.name === opts.name);
    if (!match) {
      const known = candidates.map((c) => c.name).join(", ") || "(none)";
      return { ok: false, message: `No install named "${opts.name}" found. Known installs: ${known}` };
    }
    const resolved = loadCandidate(match);
    if (!resolved) {
      return { ok: false, message: `Install "${opts.name}" is registered but its config could not be read.` };
    }
    return { ok: true, install: resolved };
  }

  if (candidates.length === 0) {
    return { ok: false, message: "No Arel OS install found. Run `npx arelos` to install." };
  }

  if (candidates.length === 1) {
    const resolved = loadCandidate(candidates[0]);
    if (!resolved) {
      return { ok: false, message: "Install is registered but its config could not be read." };
    }
    return { ok: true, install: resolved };
  }

  // Multiple installs, no name given.
  if (!opts.interactive) {
    const known = candidates.map((c) => c.name).join(", ");
    return {
      ok: false,
      message: `Multiple Arel OS installs found — pass a name. Known installs: ${known}`,
    };
  }

  const choice = await p.select({
    message: "Which install?",
    options: candidates.map((c) => ({ value: c.name, label: c.name })),
  });
  if (p.isCancel(choice)) {
    return { ok: false, message: "Cancelled." };
  }
  const match = candidates.find((c) => c.name === choice);
  const resolved = match ? loadCandidate(match) : null;
  if (!resolved) {
    return { ok: false, message: "Selected install's config could not be read." };
  }
  return { ok: true, install: resolved };
}

export function listInstallNames(): string[] {
  return listCandidates().map((c) => c.name);
}
