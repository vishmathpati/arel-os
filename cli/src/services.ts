/**
 * Ties together plist rendering + writing + launchd bootstrap. Also used by
 * `--no-service` dry runs, which stop before the launchctl calls (see
 * install.ts).
 *
 * `installDir` is the app checkout (root/app); `root` is the self-contained
 * install root that owns logs/ and config.json (0.2.0 layout). Both are
 * needed because the plist bakes in both {{INSTALL_DIR}} and {{ROOT_DIR}}.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type BootstrapSequenceEffects, bootstrapServiceSequenced } from "./launchd.js";
import { type ServiceLabels, deriveServiceLabels, launchAgentsDir, plistPath } from "./paths.js";
import { renderPlistTemplate } from "./plist.js";

export interface RenderedService {
  label: string;
  templatePath: string;
  targetPath: string;
  xml: string;
}

export function renderServicePlists(
  installDir: string,
  root: string,
  labels: ServiceLabels = deriveServiceLabels(root),
): RenderedService[] {
  const specs: Array<{ label: string; templateFile: string }> = [
    { label: labels.web, templateFile: "web.plist.tmpl" },
    { label: labels.vault, templateFile: "vault.plist.tmpl" },
  ];
  return specs.map(({ label, templateFile }) => {
    const templatePath = join(installDir, "scripts", "service", templateFile);
    if (!existsSync(templatePath)) {
      throw new Error(`Missing plist template: ${templatePath}`);
    }
    const template = readFileSync(templatePath, "utf8");
    const xml = renderPlistTemplate(template, installDir, root, label);
    return { label, templatePath, targetPath: plistPath(label), xml };
  });
}

/** Write rendered plists to ~/Library/LaunchAgents and chmod the run scripts. */
export function installServiceFiles(
  installDir: string,
  root: string,
  labels: ServiceLabels = deriveServiceLabels(root),
): RenderedService[] {
  mkdirSync(launchAgentsDir(), { recursive: true });
  // The plists' StandardOutPath/StandardErrorPath point at <root>/logs/service/*.log;
  // launchd needs that directory to exist before it can bootstrap the job (a
  // missing log dir is one confirmed cause of the "Bootstrap failed: 5:
  // Input/output error" field report — see launchd.ts docstring). install.ts
  // already calls ensureLogsDir before this, but repair/update funnel through
  // here too, so guarantee it unconditionally rather than relying on callers
  // to remember.
  mkdirSync(join(root, "logs", "service"), { recursive: true });
  const rendered = renderServicePlists(installDir, root, labels);
  for (const svc of rendered) {
    writeFileSync(svc.targetPath, svc.xml);
  }
  for (const script of ["run-web.sh", "run-vault.sh"]) {
    const p = join(installDir, "scripts", "service", script);
    if (existsSync(p)) chmodSync(p, 0o755);
  }
  return rendered;
}

/**
 * Bootstrap + kickstart both services via the field-verified race-safe
 * sequence (see launchd.ts bootstrapServiceSequenced): bootout -> poll until
 * gone -> bootstrap (retry once on EIO) -> verify loaded -> kickstart. `effects`
 * is injectable so tests can assert the full sequence, including the poll
 * loop, without ever calling real launchctl or sleeping in real time.
 */
export async function bootstrapAndStart(
  labels: ServiceLabels,
  effects?: BootstrapSequenceEffects,
): Promise<{ web: boolean; vault: boolean; errors: string[] }> {
  const errors: string[] = [];
  const webRes = await bootstrapServiceSequenced(labels.web, effects);
  if (!webRes.ok) errors.push(`web bootstrap: ${webRes.stderr.trim()}`);
  const vaultRes = await bootstrapServiceSequenced(labels.vault, effects);
  if (!vaultRes.ok) errors.push(`vault bootstrap: ${vaultRes.stderr.trim()}`);

  return { web: webRes.ok, vault: vaultRes.ok, errors };
}
