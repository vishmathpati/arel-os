/**
 * `arelos list`. Table of every registered install (name, root, ports, domain,
 * service status) — the multi-install discovery surface (0.2.0; domain column
 * added 0.2.3).
 */
import { existsSync } from "node:fs";
import pc from "picocolors";
import { readConfig, readConfigAt, resolveServiceLabels } from "./config.js";
import { getServiceStatus } from "./launchd.js";
import { legacyConfigPath } from "./paths.js";
import { isProxyRegistered } from "./proxy-service.js";
import { domainFor } from "./proxy.js";
import { readRegistry } from "./registry.js";

export async function listCommand(): Promise<number> {
  const entries = readRegistry();
  const rows: Array<{
    name: string;
    root: string;
    webPort: string;
    vaultPort: string;
    domain: string;
    status: string;
  }> = [];
  const proxyUp = isProxyRegistered();

  for (const entry of entries) {
    const config = readConfigAt(entry.root);
    if (!config) {
      rows.push({
        name: entry.name,
        root: entry.root,
        webPort: "?",
        vaultPort: "?",
        domain: "-",
        status: pc.red("config missing"),
      });
      continue;
    }
    const labels = resolveServiceLabels(config);
    const [webSvc, vaultSvc] = await Promise.all([
      getServiceStatus(labels.web),
      getServiceStatus(labels.vault),
    ]);
    const status = webSvc.loaded && vaultSvc.loaded ? pc.green("running") : pc.yellow("stopped");
    rows.push({
      name: entry.name,
      root: entry.root,
      webPort: String(config.webPort),
      vaultPort: String(config.vaultPort),
      domain: proxyUp ? domainFor(entry.slug) : "-",
      status,
    });
  }

  if (existsSync(legacyConfigPath())) {
    const legacy = readConfig();
    if (legacy) {
      const labels = resolveServiceLabels(legacy);
      const [webSvc, vaultSvc] = await Promise.all([
        getServiceStatus(labels.web),
        getServiceStatus(labels.vault),
      ]);
      const status = webSvc.loaded && vaultSvc.loaded ? pc.green("running") : pc.yellow("stopped");
      rows.push({
        name: "(unnamed — legacy install)",
        root: legacy.installDir,
        webPort: String(legacy.webPort),
        vaultPort: String(legacy.vaultPort),
        // Legacy installs have no slug/registry entry, so no domain to derive.
        domain: "-",
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
  const domainWidth = Math.max(6, ...rows.map((r) => r.domain.length));
  console.log(
    `${"NAME".padEnd(nameWidth)}  ${"ROOT".padEnd(rootWidth)}  WEB    VAULT  ${"DOMAIN".padEnd(domainWidth)}  STATUS`,
  );
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(nameWidth)}  ${row.root.padEnd(rootWidth)}  ${row.webPort.padEnd(5)}  ${row.vaultPort.padEnd(5)}  ${row.domain.padEnd(domainWidth)}  ${row.status}`,
    );
  }
  return 0;
}
