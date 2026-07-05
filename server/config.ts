/**
 * Arel OS config loader — single source of truth for install-time settings.
 * Reads `~/.arelos/config.json` (or `ARELOS_CONFIG_PATH` override). When the
 * file is absent (e.g. a contributor running `bun run dev` from a checkout,
 * or CI), synthesizes sane defaults so nothing requires an install step.
 *
 * Production is authoritative from the file; the dev-fallback path still
 * honors `ARELOS_VAULT_PATH` / `ARELOS_VAULT_PORT` so existing dev workflows
 * keep working without writing a config file.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ArelConfig {
  version: number;
  displayName: string;
  installDir: string;
  vaultPath: string;
  webPort: number;
  vaultPort: number;
}

const CONFIG_PATH = process.env.ARELOS_CONFIG_PATH ?? join(homedir(), ".arelos", "config.json");

let cached: ArelConfig | null = null;

/** Load (and cache) the Arel OS config. See module docstring for precedence. */
export function loadConfig(): ArelConfig {
  if (cached) return cached;

  if (!existsSync(CONFIG_PATH)) {
    cached = {
      version: 1,
      displayName: "Arel OS",
      installDir: process.cwd(),
      vaultPath: process.env.ARELOS_VAULT_PATH ?? join(process.cwd(), "vault"),
      webPort: Number(process.env.ARELOS_WEB_PORT) || 1347,
      vaultPort: Number(process.env.ARELOS_VAULT_PORT) || 5274,
    };
    return cached;
  }

  const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as ArelConfig;
  if (typeof parsed !== "object" || parsed === null || parsed.version !== 1) {
    throw new Error(
      `Invalid or unsupported config at ${CONFIG_PATH}: expected { version: 1, ... }`,
    );
  }
  cached = parsed;
  return cached;
}

/** Test-only: clear the cached config so a test can reload with a new env/file. */
export function __resetConfigCache(): void {
  cached = null;
}
