/**
 * Pure planning/validation logic for the install flow, factored out of the
 * interactive prompt wiring in install.ts so it can be unit tested without
 * a TTY. Each function here validates one prompt's answer.
 *
 * 0.2.0 self-contained layout: everything for one install lives under a
 * single `root` folder (`<parent>/<slug>`) — `root/app` (the git checkout),
 * `root/vault`, `root/logs/service`, and `root/config.json`. `installDir` in
 * this module and in ArelConfig now specifically means the app checkout
 * (`root/app`), not the root — see toArelConfig.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { accessSync, constants } from "node:fs";
import { dirname, join } from "node:path";
import { deriveServiceLabels, expandHome, isTccProtectedPath, type ServiceLabels } from "./paths.js";
import { findFreePort, isValidPort } from "./ports.js";

export interface InstallAnswers {
  displayName: string;
  root: string;
  installDir: string;
  vaultPath: string;
  webPort: number;
  vaultPort: number;
}

export const DEFAULTS = {
  displayName: "Arel OS",
  parentDir: "~",
  slugFallback: "arelos",
  webPort: 1347,
  vaultPort: 5274,
};

export function normalizeDisplayName(input: string): string {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : DEFAULTS.displayName;
}

/**
 * Slugify a chosen display name into a safe directory-name fragment:
 * lowercase, spaces/unsafe chars -> dashes, collapsed and trimmed. Falls back
 * to the fixed default install dir's basename when the slug would be empty
 * (e.g. a name made entirely of emoji/punctuation).
 */
export function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Slug fallback when the chosen name slugifies to empty (e.g. all emoji/punctuation). */
export function slugOrFallback(displayName: string): string {
  const slug = slugifyName(displayName);
  return slug || DEFAULTS.slugFallback;
}

/** Default parent dir offered for "change location?" — always the home directory. */
export function defaultParentDir(): string {
  return DEFAULTS.parentDir;
}

/**
 * The self-contained root for this install: always `<parent>/<slug>` — we
 * never install loose into an existing folder, so the slug subfolder is
 * appended unconditionally, even when the user changes the parent.
 */
export function rootFor(parentDir: string, displayName: string): string {
  return join(expandHome(parentDir), slugOrFallback(displayName));
}

/** installDir (the app checkout) and vaultPath are fixed children of root. */
export function appDirFor(root: string): string {
  return join(root, "app");
}

export function vaultPathFor(root: string): string {
  return join(root, "vault");
}

export interface RootDirCheck {
  path: string;
  parentWritable: boolean;
  exists: boolean;
  nonEmpty: boolean;
  isPriorArelosInstall: boolean;
  isTccProtected: boolean;
}

/**
 * Plain-English explanation shown (and re-prompted with) when the chosen
 * root or vault path resolves to inside a macOS TCC-protected folder
 * (field bug: launchd-spawned services get `Operation not permitted`,
 * exit 126, and crash-loop forever from Desktop/Documents/Downloads/iCloud
 * Drive — see paths.ts isTccProtectedPath).
 */
export const TCC_PROTECTED_PATH_MESSAGE =
  "macOS blocks background services from running in Desktop, Documents, Downloads, or iCloud Drive. Pick a folder in your home directory instead.";

/**
 * Validate a candidate self-contained root folder (`<parent>/<slug>`). A
 * "prior arelos install of the same name" is recognized by the self-contained
 * layout's own marker — root/app is a git checkout — so re-running the
 * installer against the same root is a repair, not a collision.
 */
export function checkRootDir(rawPath: string): RootDirCheck {
  const path = expandHome(rawPath);
  const parent = dirname(path);
  let parentWritable = true;
  try {
    accessSync(existsSync(parent) ? parent : dirname(parent), constants.W_OK);
  } catch {
    parentWritable = false;
  }
  const exists = existsSync(path);
  let nonEmpty = false;
  let isPriorArelosInstall = false;
  if (exists && statSync(path).isDirectory()) {
    const entries = readdirSync(path);
    nonEmpty = entries.length > 0;
    const appDir = join(path, "app");
    isPriorArelosInstall =
      existsSync(join(appDir, ".git")) && existsSync(join(appDir, "package.json"));
  }
  return { path, parentWritable, exists, nonEmpty, isPriorArelosInstall, isTccProtected: isTccProtectedPath(path) };
}

export interface PortResolution {
  requested: number;
  resolved: number;
  wasFree: boolean;
}

/** Validate a chosen port and, if it's taken, propose the next free one. */
export async function resolvePort(requested: number): Promise<PortResolution> {
  if (!isValidPort(requested)) {
    throw new Error(`Port ${requested} is invalid — must be an integer between 1024 and 65535.`);
  }
  const { isPortFree } = await import("./ports.js");
  const free = await isPortFree(requested);
  if (free) return { requested, resolved: requested, wasFree: true };
  const suggestion = await findFreePort(requested + 1);
  return { requested, resolved: suggestion, wasFree: false };
}

export function toArelConfig(answers: InstallAnswers): {
  version: 1;
  displayName: string;
  root: string;
  installDir: string;
  vaultPath: string;
  webPort: number;
  vaultPort: number;
  serviceLabels: ServiceLabels;
} {
  const root = expandHome(answers.root);
  const installDir = expandHome(answers.installDir);
  return {
    version: 1,
    displayName: answers.displayName,
    root,
    installDir,
    vaultPath: expandHome(answers.vaultPath),
    webPort: answers.webPort,
    vaultPort: answers.vaultPort,
    // Labels are derived from root, not installDir: root is what's unique
    // per named install; installDir (root/app) would collide in derivation
    // only coincidentally, but keying off root is the more direct contract.
    serviceLabels: deriveServiceLabels(root),
  };
}
