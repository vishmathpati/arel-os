/**
 * Ties together plist rendering + writing + launchd bootstrap (spec §1 Step 11,
 * §3.1 Repair). Also used by `--no-service` dry runs, which stop before the
 * launchctl calls (see install.ts).
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootstrapService, kickstartService } from "./launchd.js";
import { deriveServiceLabels, launchAgentsDir, plistPath, type ServiceLabels } from "./paths.js";
import { renderPlistTemplate } from "./plist.js";

export interface RenderedService {
  label: string;
  templatePath: string;
  targetPath: string;
  xml: string;
}

export function renderServicePlists(installDir: string, labels: ServiceLabels = deriveServiceLabels(installDir)): RenderedService[] {
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
    const xml = renderPlistTemplate(template, installDir, label);
    return { label, templatePath, targetPath: plistPath(label), xml };
  });
}

/** Write rendered plists to ~/Library/LaunchAgents and chmod the run scripts. */
export function installServiceFiles(installDir: string, labels: ServiceLabels = deriveServiceLabels(installDir)): RenderedService[] {
  mkdirSync(launchAgentsDir(), { recursive: true });
  // The plists' StandardOutPath/StandardErrorPath point at <installDir>/logs/service/*.log;
  // launchd needs that directory to exist before it can bootstrap the job (a
  // missing log dir is one confirmed cause of the "Bootstrap failed: 5:
  // Input/output error" field report — see launchd.ts docstring). install.ts
  // already calls ensureLogsDir before this, but repair/update funnel through
  // here too, so guarantee it unconditionally rather than relying on callers
  // to remember.
  mkdirSync(join(installDir, "logs", "service"), { recursive: true });
  const rendered = renderServicePlists(installDir, labels);
  for (const svc of rendered) {
    writeFileSync(svc.targetPath, svc.xml);
  }
  for (const script of ["run-web.sh", "run-vault.sh"]) {
    const p = join(installDir, "scripts", "service", script);
    if (existsSync(p)) chmodSync(p, 0o755);
  }
  return rendered;
}

/** Bootstrap + kickstart both services (idempotent bootout-then-bootstrap). */
export async function bootstrapAndStart(
  labels: ServiceLabels,
): Promise<{ web: boolean; vault: boolean; errors: string[] }> {
  const errors: string[] = [];
  const webRes = await bootstrapService(labels.web);
  if (!webRes.ok) errors.push(`web bootstrap: ${webRes.stderr.trim()}`);
  const vaultRes = await bootstrapService(labels.vault);
  if (!vaultRes.ok) errors.push(`vault bootstrap: ${vaultRes.stderr.trim()}`);

  const webKick = await kickstartService(labels.web);
  if (!webKick.ok) errors.push(`web kickstart: ${webKick.stderr.trim()}`);
  const vaultKick = await kickstartService(labels.vault);
  if (!vaultKick.ok) errors.push(`vault kickstart: ${vaultKick.stderr.trim()}`);

  return { web: webRes.ok && webKick.ok, vault: vaultRes.ok && vaultKick.ok, errors };
}
