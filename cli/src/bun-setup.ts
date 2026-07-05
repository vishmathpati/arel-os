/**
 * Bun install/detection (spec §1 Step 7). npx only guarantees Node — Bun is
 * installed during setup if missing, via the official installer script.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { commandExists, runCapture, runStreaming } from "./exec.js";

const MIN_BUN_MAJOR = 1;
const MIN_BUN_MINOR = 1;

export function resolvedBunPath(): string {
  return join(homedir(), ".bun", "bin", "bun");
}

export function findBun(): string | null {
  if (commandExists("bun")) return "bun";
  const resolved = resolvedBunPath();
  if (existsSync(resolved)) return resolved;
  return null;
}

export function parseBunVersion(versionOutput: string): { major: number; minor: number } | null {
  const match = versionOutput.trim().match(/^(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

export function meetsMinimumVersion(version: { major: number; minor: number } | null): boolean {
  if (!version) return false;
  if (version.major !== MIN_BUN_MAJOR) return version.major > MIN_BUN_MAJOR;
  return version.minor >= MIN_BUN_MINOR;
}

export async function bunVersion(bunBin: string): Promise<{ major: number; minor: number } | null> {
  const res = await runCapture(bunBin, ["--version"]);
  if (res.code !== 0) return null;
  return parseBunVersion(res.stdout);
}

export const MANUAL_BUN_INSTALL_HINT = "curl -fsSL https://bun.sh/install | bash";

/** Install Bun via the official installer script. Returns the resolved bun binary path, or null on failure. */
export async function installBun(): Promise<string | null> {
  const res = await runStreaming("bash", ["-c", "curl -fsSL https://bun.sh/install | bash"]);
  if (res.code !== 0) return null;
  const resolved = resolvedBunPath();
  return existsSync(resolved) ? resolved : null;
}

/** Ensure a usable Bun is present, installing it if missing. Returns the bun binary to invoke. */
export async function ensureBun(): Promise<{ bunBin: string } | { error: string }> {
  let bunBin = findBun();
  if (!bunBin) {
    bunBin = await installBun();
    if (!bunBin) {
      return { error: `Bun install failed. Install manually: ${MANUAL_BUN_INSTALL_HINT}` };
    }
  }
  const version = await bunVersion(bunBin);
  if (!meetsMinimumVersion(version)) {
    return {
      error: `Bun ${version ? `${version.major}.${version.minor}` : "(unknown)"} found, but >= ${MIN_BUN_MAJOR}.${MIN_BUN_MINOR} is required. Reinstall: ${MANUAL_BUN_INSTALL_HINT}`,
    };
  }
  return { bunBin };
}
