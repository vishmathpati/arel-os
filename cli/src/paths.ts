/**
 * Central place for the fixed, well-known paths `rlo` reads/writes.
 * Everything here honors ARELOS_CONFIG_PATH so tests/dry-runs never touch
 * the real ~/.arelos.
 */
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

export const WEB_LABEL = "com.arelos.web";
export const VAULT_LABEL = "com.arelos.vault";

export function plistPath(label: typeof WEB_LABEL | typeof VAULT_LABEL): string {
  return join(launchAgentsDir(), `${label}.plist`);
}

/** Expand a leading `~` to the user's home directory. */
export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}
