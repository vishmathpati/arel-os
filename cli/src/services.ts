/**
 * Ties together plist rendering + writing + launchd bootstrap (spec §1 Step 11,
 * §3.1 Repair). Also used by `--no-service` dry runs, which stop before the
 * launchctl calls (see install.ts).
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bootstrapService, kickstartService } from "./launchd.js";
import { VAULT_LABEL, WEB_LABEL, launchAgentsDir, plistPath } from "./paths.js";
import { renderPlistTemplate } from "./plist.js";

export interface RenderedService {
  label: typeof WEB_LABEL | typeof VAULT_LABEL;
  templatePath: string;
  targetPath: string;
  xml: string;
}

export function renderServicePlists(installDir: string): RenderedService[] {
  const specs: Array<{ label: typeof WEB_LABEL | typeof VAULT_LABEL; templateFile: string }> = [
    { label: WEB_LABEL, templateFile: "com.arelos.web.plist.tmpl" },
    { label: VAULT_LABEL, templateFile: "com.arelos.vault.plist.tmpl" },
  ];
  return specs.map(({ label, templateFile }) => {
    const templatePath = join(installDir, "scripts", "service", templateFile);
    if (!existsSync(templatePath)) {
      throw new Error(`Missing plist template: ${templatePath}`);
    }
    const template = readFileSync(templatePath, "utf8");
    const xml = renderPlistTemplate(template, installDir);
    return { label, templatePath, targetPath: plistPath(label), xml };
  });
}

/** Write rendered plists to ~/Library/LaunchAgents and chmod the run scripts. */
export function installServiceFiles(installDir: string): RenderedService[] {
  mkdirSync(launchAgentsDir(), { recursive: true });
  const rendered = renderServicePlists(installDir);
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
export async function bootstrapAndStart(): Promise<{ web: boolean; vault: boolean; errors: string[] }> {
  const errors: string[] = [];
  const webRes = await bootstrapService(WEB_LABEL);
  if (!webRes.ok) errors.push(`web bootstrap: ${webRes.stderr.trim()}`);
  const vaultRes = await bootstrapService(VAULT_LABEL);
  if (!vaultRes.ok) errors.push(`vault bootstrap: ${vaultRes.stderr.trim()}`);

  const webKick = await kickstartService(WEB_LABEL);
  if (!webKick.ok) errors.push(`web kickstart: ${webKick.stderr.trim()}`);
  const vaultKick = await kickstartService(VAULT_LABEL);
  if (!vaultKick.ok) errors.push(`vault kickstart: ${vaultKick.stderr.trim()}`);

  return { web: webRes.ok && webKick.ok, vault: vaultRes.ok && vaultKick.ok, errors };
}
