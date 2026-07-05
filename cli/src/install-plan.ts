/**
 * Pure planning/validation logic for the install flow, factored out of the
 * interactive prompt wiring in install.ts so it can be unit tested without
 * a TTY. Each function here validates one prompt's answer per rlo-cli-spec §1.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { accessSync, constants } from "node:fs";
import { dirname } from "node:path";
import { deriveServiceLabels, expandHome, isTccProtectedPath, type ServiceLabels } from "./paths.js";
import { findFreePort, isValidPort } from "./ports.js";

export interface InstallAnswers {
  displayName: string;
  installDir: string;
  vaultPath: string;
  webPort: number;
  vaultPort: number;
}

export const DEFAULTS = {
  displayName: "Arel OS",
  installDir: "~/ArelOS",
  vaultPathSuffix: "vault",
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

/** Default install dir derived from the chosen display name, e.g. "My Brain" -> "~/my-brain". */
export function defaultInstallDirFor(displayName: string): string {
  const slug = slugifyName(displayName);
  if (!slug) return DEFAULTS.installDir;
  return `~/${slug}`;
}

export interface InstallDirCheck {
  path: string;
  parentWritable: boolean;
  exists: boolean;
  nonEmpty: boolean;
  isPriorArelosInstall: boolean;
  isTccProtected: boolean;
}

/**
 * Plain-English explanation shown (and re-prompted with) when the chosen
 * install dir or vault path resolves to inside a macOS TCC-protected folder
 * (field bug: launchd-spawned services get `Operation not permitted`,
 * exit 126, and crash-loop forever from Desktop/Documents/Downloads/iCloud
 * Drive — see rlo-cli-spec.md and paths.ts isTccProtectedPath).
 */
export const TCC_PROTECTED_PATH_MESSAGE =
  "macOS blocks background services from running in Desktop, Documents, Downloads, or iCloud Drive. Pick a folder in your home directory instead.";

export function checkInstallDir(rawPath: string): InstallDirCheck {
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
    isPriorArelosInstall = entries.includes(".git") && entries.includes("package.json");
  }
  return { path, parentWritable, exists, nonEmpty, isPriorArelosInstall, isTccProtected: isTccProtectedPath(path) };
}

export function defaultVaultPath(installDir: string): string {
  return `${expandHome(installDir)}/${DEFAULTS.vaultPathSuffix}`;
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
  installDir: string;
  vaultPath: string;
  webPort: number;
  vaultPort: number;
  serviceLabels: ServiceLabels;
} {
  const installDir = expandHome(answers.installDir);
  return {
    version: 1,
    displayName: answers.displayName,
    installDir,
    vaultPath: expandHome(answers.vaultPath),
    webPort: answers.webPort,
    vaultPort: answers.vaultPort,
    serviceLabels: deriveServiceLabels(installDir),
  };
}
