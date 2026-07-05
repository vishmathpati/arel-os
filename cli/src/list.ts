/**
 * `arelos list`. Table of every registered install (name, root, ports, service
 * status) — the multi-install discovery surface (0.2.0).
 */
import pc from "picocolors";
import { readConfig, readConfigAt, resolveServiceLabels } from "./config.js";
import { getServiceStatus } from "./launchd.js";
import { readRegistry } from "./registry.js";
import { existsSync } from "node:fs";
import { legacyConfigPath } from "./paths.js";

export async function listCommand(): Promise<number> {
  const entries = readRegistry();
  const rows: Array<{ name: string; root: string; webPort: string; vaultPort: string; status: string }> = [];

  for (const entry of entries) {
    const config = readConfigAt(entry.root);
    if (!config) {
      rows.push({ name: entry.name, root: entry.root, webPort: "?", vaultPort: "?", status: pc.red("config missing") });
      continue;
    }
    const labels = resolveServiceLabels(config);
    const [webSvc, vaultSvc] = await Promise.all([getServiceStatus(labels.web), getServiceStatus(labels.vault)]);
    const status = webSvc.loaded && vaultSvc.loaded ? pc.green("running") : pc.yellow("stopped");
    rows.push({
      name: entry.name,
      root: entry.root,
      webPort: String(config.webPort),
      vaultPort: String(config.vaultPort),
      status,
    });
  }

  if (existsSync(legacyConfigPath())) {
    const legacy = readConfig();
    if (legacy) {
      const labels = resolveServiceLabels(legacy);
      const [webSvc, vaultSvc] = await Promise.all([getServiceStatus(labels.web), getServiceStatus(labels.vault)]);
      const status = webSvc.loaded && vaultSvc.loaded ? pc.green("running") : pc.yellow("stopped");
      rows.push({
        name: "(unnamed — legacy install)",
        root: legacy.installDir,
        webPort: String(legacy.webPort),
        vaultPort: String(legacy.vaultPort),
        status,
      });
    }
  }

  if (rows.length === 0) {
    console.log("No Arel OS installs found. Run `npx arelos` to install.");
    return 0;
  }

  const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));
  const rootWidth = Math.max(4, ...rows.map((r) => r.root.length));
  console.log(`${"NAME".padEnd(nameWidth)}  ${"ROOT".padEnd(rootWidth)}  WEB    VAULT  STATUS`);
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(nameWidth)}  ${row.root.padEnd(rootWidth)}  ${row.webPort.padEnd(5)}  ${row.vaultPort.padEnd(5)}  ${row.status}`,
    );
  }
  return 0;
}
