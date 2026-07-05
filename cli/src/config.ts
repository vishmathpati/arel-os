/**
 * arelos's own config read/write helpers — mirrors the shape read by
 * server/config.ts. arelos is the writer, the app is the reader; this is the
 * one contract between them.
 *
 * 0.2.0: config is per-install, at <root>/config.json (see paths.ts
 * installConfigPath). The old single fixed ~/.arelos/config.json is kept as
 * a read-only legacy fallback ("unnamed install") for 0.1.x installs.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  configPathOverride,
  installConfigPath,
  legacyConfigPath,
  LEGACY_VAULT_LABEL,
  LEGACY_WEB_LABEL,
  type ServiceLabels,
} from "./paths.js";

export interface ArelConfig {
  version: 1;
  displayName: string;
  /**
   * Self-contained install root (0.2.0+). Optional so legacy 0.1.x configs
   * (which had no concept of a root — installDir was the app checkout itself
   * at the top level) still parse; readLegacyConfig is the only path that can
   * produce one of these.
   */
  root?: string;
  installDir: string;
  vaultPath: string;
  webPort: number;
  vaultPort: number;
  /**
   * Per-install launchd labels (see paths.ts deriveServiceLabels). Optional
   * so configs written before this field existed still parse; callers fall
   * back to the legacy fixed labels (com.arelos.web/.vault) when absent.
   */
  serviceLabels?: {
    web: string;
    vault: string;
  };
}

function parseConfigFile(p: string): ArelConfig | null {
  if (!existsSync(p)) return null;
  const raw = JSON.parse(readFileSync(p, "utf8"));
  if (typeof raw !== "object" || raw === null || raw.version !== 1) {
    throw new Error(`Invalid or unsupported config at ${p}: expected { version: 1, ... }`);
  }
  return raw as ArelConfig;
}

/** Read the config at a specific known root's config.json. */
export function readConfigAt(root: string): ArelConfig | null {
  return parseConfigFile(installConfigPath(root));
}

/**
 * Read a single config with no registry context: honors ARELOS_CONFIG_PATH
 * if set (tests / pointing at one install directly), else falls back to the
 * legacy fixed ~/.arelos/config.json (pre-0.2.0 "unnamed install"). Used by
 * callers that haven't gone through the registry (e.g. a bare `arelos status`
 * when there's exactly one legacy install and no registry entries).
 */
export function readConfig(): ArelConfig | null {
  const override = configPathOverride();
  if (override) return parseConfigFile(override);
  return parseConfigFile(legacyConfigPath());
}

/**
 * Write config atomically: write to a .tmp sibling then rename over the
 * target. Guarantees a reader never observes a partially written file —
 * config write is last-writer-wins; never partially written.
 */
export function writeConfig(config: ArelConfig, targetPath?: string): void {
  const p = targetPath ?? configPathOverride() ?? (config.root ? installConfigPath(config.root) : legacyConfigPath());
  mkdirSync(dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, p);
}

/**
 * The labels to actually operate on for an existing install: config.serviceLabels
 * when present (installs made after this fix), else the legacy fixed labels
 * (installs made before it — backward compat).
 */
export function resolveServiceLabels(config: ArelConfig): ServiceLabels {
  return config.serviceLabels ?? { web: LEGACY_WEB_LABEL, vault: LEGACY_VAULT_LABEL };
}

/**
 * The self-contained root that owns this install's logs/service/ and
 * config.json (0.2.0 layout). Legacy (pre-0.2.0) configs have no `root` field
 * — for those, installDir *was* the root (logs lived at installDir/logs),
 * so fall back to it.
 */
export function resolveRoot(config: ArelConfig): string {
  return config.root ?? config.installDir;
}
