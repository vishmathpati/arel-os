/**
 * Central place for the fixed, well-known paths `rlo` reads/writes.
 * Everything here honors ARELOS_CONFIG_PATH so tests/dry-runs never touch
 * the real ~/.arelos.
 */
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

export function configPath(): string {
  return process.env.ARELOS_CONFIG_PATH ?? join(homedir(), ".arelos", "config.json");
}

export function configDir(): string {
  return join(configPath(), "..");
}

export function launchAgentsDir(): string {
  return join(homedir(), "Library", "LaunchAgents");
}

/**
 * Pre-per-install-label launchd labels. A second install on the same Mac used
 * to collide on these fixed labels — see serviceLabels below for the fix.
 * Kept as the fallback for configs written before this fix (spec: legacy
 * compat) and as the thing preflight checks for "another install exists".
 */
export const LEGACY_WEB_LABEL = "com.arelos.web";
export const LEGACY_VAULT_LABEL = "com.arelos.vault";

export interface ServiceLabels {
  web: string;
  vault: string;
}

/**
 * Short stable hash of the resolved installDir: same dir -> same slug across
 * reinstalls/repairs, different dirs -> different slugs, so two installs on
 * one Mac never fight over the same launchd label.
 */
export function installSlug(installDir: string): string {
  return createHash("sha256").update(installDir).digest("hex").slice(0, 8);
}

/** Derive the unique per-install label pair from the resolved installDir. */
export function deriveServiceLabels(installDir: string): ServiceLabels {
  const slug = installSlug(installDir);
  return {
    web: `com.arelos.${slug}.web`,
    vault: `com.arelos.${slug}.vault`,
  };
}

export function plistPath(label: string): string {
  return join(launchAgentsDir(), `${label}.plist`);
}

/** Expand a leading `~` to the user's home directory. */
export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}
