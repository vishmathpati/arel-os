/**
 * rlo's own config read/write helpers — mirrors the shape read by
 * server/config.ts (portability-contract.md §1.1/§1.2). rlo is the writer,
 * the app is the reader; this is the one contract between them.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { configPath } from "./paths.js";

export interface ArelConfig {
  version: 1;
  displayName: string;
  installDir: string;
  vaultPath: string;
  webPort: number;
  vaultPort: number;
}

export function readConfig(): ArelConfig | null {
  const p = configPath();
  if (!existsSync(p)) return null;
  const raw = JSON.parse(readFileSync(p, "utf8"));
  if (typeof raw !== "object" || raw === null || raw.version !== 1) {
    throw new Error(`Invalid or unsupported config at ${p}: expected { version: 1, ... }`);
  }
  return raw as ArelConfig;
}

/**
 * Write config atomically: write to a .tmp sibling then rename over the
 * target. Guarantees a reader never observes a partially written file
 * (spec §3.2 "Config write is last-writer-wins; never partially written").
 */
export function writeConfig(config: ArelConfig): void {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, p);
}
