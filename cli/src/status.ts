/**
 * `rlo status` (spec §2). Config summary + service state + port probes +
 * git revision / behind-origin check.
 */
import pc from "picocolors";
import { readConfig } from "./config.js";
import { checkVaultHealth, checkWebHealth } from "./health.js";
import { getServiceStatus } from "./launchd.js";
import { currentRevision, isBehindOrigin } from "./repo.js";
import { VAULT_LABEL, WEB_LABEL } from "./paths.js";

export async function statusCommand(): Promise<number> {
  const config = readConfig();
  if (!config) {
    console.error("No Arel OS install found. Run `npx arelos` to install.");
    return 1;
  }

  console.log(pc.bold(config.displayName));
  console.log(`  Install dir: ${config.installDir}`);
  console.log(`  Vault path:  ${config.vaultPath}`);
  console.log(`  Web port:    ${config.webPort}`);
  console.log(`  Vault port:  ${config.vaultPort}`);
  console.log("");

  const [webSvc, vaultSvc, webHealth, vaultHealth, rev, behind] = await Promise.all([
    getServiceStatus(WEB_LABEL),
    getServiceStatus(VAULT_LABEL),
    checkWebHealth(config.webPort),
    checkVaultHealth(config.vaultPort),
    currentRevision(config.installDir),
    isBehindOrigin(config.installDir),
  ]);

  printService("web", webSvc, webHealth.up, webHealth.status ? `HTTP ${webHealth.status}` : webHealth.error);
  printService(
    "vault",
    vaultSvc,
    vaultHealth.up,
    vaultHealth.up ? `displayName=${vaultHealth.displayName}` : vaultHealth.error,
  );

  console.log("");
  console.log(`  Revision: ${rev ?? "unknown"}${behind === true ? pc.yellow(" (behind origin — run arelos update)") : behind === false ? " (up to date)" : ""}`);

  return 0;
}

function printService(
  name: string,
  svc: { loaded: boolean; pid: number | null; lastExitCode: number | null },
  up: boolean,
  detail?: string,
) {
  const stateLabel = up ? pc.green("up") : pc.red("down");
  const loadedLabel = svc.loaded ? "loaded" : "not loaded";
  const pidLabel = svc.pid ? `pid ${svc.pid}` : "no pid";
  console.log(`  ${name.padEnd(6)} ${stateLabel}  (${loadedLabel}, ${pidLabel})  ${detail ?? ""}`);
}
