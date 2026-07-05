/**
 * Vault scaffolding + supporting install-dir setup (spec §1 Step 9).
 * Only copies the template vault when the destination is empty — never
 * overwrites user data (spec §3.2 idempotency rule).
 */
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export class TemplateVaultMissingError extends Error {
  constructor(templateDir: string) {
    super(
      `templates/vault/ is missing at ${templateDir}. This is a repo gap — ` +
        `the app repo must ship a seed vault at templates/vault/ (see portability-contract.md / rlo-cli-spec.md §1 Step 9). Cannot scaffold a new vault without it.`,
    );
    this.name = "TemplateVaultMissingError";
  }
}

export function isDirEmpty(dir: string): boolean {
  if (!existsSync(dir)) return true;
  return readdirSync(dir).length === 0;
}

/**
 * Copy templates/vault/** from the cloned app repo into vaultPath, only if
 * vaultPath is empty/absent. Throws TemplateVaultMissingError if the source
 * template is absent in the repo (hard error per spec §3.3).
 */
export function scaffoldVault(installDir: string, vaultPath: string): { copied: boolean } {
  const templateDir = join(installDir, "templates", "vault");
  if (!existsSync(templateDir)) {
    throw new TemplateVaultMissingError(templateDir);
  }
  if (!isDirEmpty(vaultPath)) {
    return { copied: false };
  }
  mkdirSync(vaultPath, { recursive: true });
  cpSync(templateDir, vaultPath, { recursive: true });
  return { copied: true };
}

/** Create <installDir>/logs/service/ — must exist before launchd bootstraps
 * the plists, since they reference it for stdout/stderr (spec, implementer notes). */
export function ensureLogsDir(installDir: string): string {
  const dir = join(installDir, "logs", "service");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write .env from .env.example if absent; never overwrite an existing .env. */
export function ensureEnvFile(installDir: string): { created: boolean } {
  const envPath = join(installDir, ".env");
  const examplePath = join(installDir, ".env.example");
  if (existsSync(envPath)) return { created: false };
  if (!existsSync(examplePath)) return { created: false };
  cpSync(examplePath, envPath);
  return { created: true };
}
