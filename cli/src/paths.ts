/**
 * Central place for the fixed, well-known paths `arelos` reads/writes.
 * Everything here honors ARELOS_CONFIG_PATH / ARELOS_REGISTRY_PATH so
 * tests/dry-runs never touch the real ~/.arelos.
 */
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Per-install config now lives at <root>/config.json (0.2.0 self-contained
 * layout). ARELOS_CONFIG_PATH remains the escape hatch for tests/dry-runs and
 * for pointing a command at a specific install's config directly. There is no
 * single well-known default anymore — callers that need "the" config either
 * have a root in hand (installConfigPath(root)) or go through the registry.
 */
export function installConfigPath(root: string): string {
  return join(root, "config.json");
}

/**
 * Pre-0.2.0 fixed config location. Still read as a fallback "unnamed install"
 * so 0.1.x installs remain manageable after upgrading the CLI.
 */
export function legacyConfigPath(): string {
  return join(homedir(), ".arelos", "config.json");
}

/** Explicit override honored everywhere a single config path is needed directly. */
export function configPathOverride(): string | null {
  return process.env.ARELOS_CONFIG_PATH ?? null;
}

export function configDir(): string {
  return join(homedir(), ".arelos");
}

/**
 * Global multi-install registry: ~/.arelos/installs.json, listing every named
 * install on this Mac ({name, slug, root, createdAt}). ARELOS_REGISTRY_PATH
 * overrides the location for tests so they never touch the real file.
 */
export function registryPath(): string {
  return process.env.ARELOS_REGISTRY_PATH ?? join(homedir(), ".arelos", "installs.json");
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

/**
 * Folders macOS TCC privacy protection blocks background (launchd-spawned)
 * processes from accessing without an interactive grant: Desktop, Documents,
 * Downloads, and iCloud Drive (~/Library/Mobile Documents). A service that
 * installs into one of these will register fine but crash-loop forever on
 * start with `Operation not permitted` (field bug: exit 126). Checked against
 * the *resolved* (home-expanded) path so `~/Desktop/foo` and
 * `/Users/x/Desktop/foo` are both caught.
 */
const TCC_PROTECTED_SUFFIXES = ["Desktop", "Documents", "Downloads", "Library/Mobile Documents"] as const;

/**
 * True if `rawPath` resolves to inside (or exactly at) one of the TCC-protected
 * directories under `home`. Pure string/path logic — no filesystem access —
 * so it can be unit tested without touching disk.
 *
 * - Exact home root (`~`) is safe.
 * - Sibling names that merely start with the same string (e.g. `~/Desktopx`)
 *   are safe — matched by path segment, not string prefix.
 * - Nested arbitrarily deep paths inside a protected dir are caught.
 * - Case-insensitive, matching macOS's default case-insensitive APFS/HFS+.
 */
export function isTccProtectedPath(rawPath: string, home: string = homedir()): boolean {
  const resolved = expandHomeWith(rawPath, home);
  const normalizedHome = normalizeForCompare(home);
  const normalizedResolved = normalizeForCompare(resolved);

  for (const suffix of TCC_PROTECTED_SUFFIXES) {
    const protectedDir = normalizeForCompare(join(normalizedHome, suffix));
    if (normalizedResolved === protectedDir || normalizedResolved.startsWith(`${protectedDir}/`)) {
      return true;
    }
  }
  return false;
}

function expandHomeWith(p: string, home: string): string {
  if (p === "~") return home;
  if (p.startsWith("~/")) return join(home, p.slice(2));
  return p;
}

function normalizeForCompare(p: string): string {
  // Collapse any trailing slash and lowercase for macOS's default
  // case-insensitive filesystem semantics.
  const withoutTrailingSlash = p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
  return withoutTrailingSlash.toLowerCase();
}
