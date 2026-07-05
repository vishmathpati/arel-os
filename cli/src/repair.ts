/**
 * Existing-install repair/update menu (spec §1 Step 0, §3.1). Shown whenever
 * ~/.arelos/config.json already exists so a re-run of `npx arelos` never
 * silently reinstalls.
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureBun } from "./bun-setup.js";
import type { ArelConfig } from "./config.js";
import { resolveRoot, resolveServiceLabels } from "./config.js";
import { runStreaming } from "./exec.js";
import { formatHealthTimeoutDiagnostics, waitForHealthy } from "./health.js";
import { lastLines, logPathFor } from "./logs.js";
import { canBindPort80, installProxyService } from "./proxy-service.js";
import { bootstrapAndStart, installServiceFiles } from "./services.js";
import { runUpdate } from "./update.js";

export async function runRepairMenu(existing: ArelConfig): Promise<number> {
  p.intro(pc.bold("Existing Arel OS install detected"));
  p.note(
    [
      `Name:        ${existing.displayName}`,
      `Install dir: ${existing.installDir}`,
      `Vault path:  ${existing.vaultPath}`,
      `Web port:    ${existing.webPort}`,
      `Vault port:  ${existing.vaultPort}`,
    ].join("\n"),
    "Detected install",
  );

  const choice = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "update", label: "Update", hint: "git pull + rebuild + restart" },
      {
        value: "repair",
        label: "Repair",
        hint: "re-render services + rebuild, keep vault & config",
      },
      { value: "reinstall", label: "Reinstall elsewhere", hint: "fresh install at a new location" },
      { value: "cancel", label: "Cancel" },
    ],
  });
  if (p.isCancel(choice) || choice === "cancel") {
    p.cancel("Cancelled.");
    return 1;
  }

  if (choice === "update") {
    return runUpdate(existing);
  }

  if (choice === "repair") {
    return runRepair(existing);
  }

  if (choice === "reinstall") {
    p.log.message(
      "Just re-run `npx arelos` with a different name — every install is self-contained, so a new name " +
        "creates a fresh, independent install side-by-side with this one (see `arelos list`).",
    );
    return 0;
  }

  return 1;
}

async function runRepair(existing: ArelConfig): Promise<number> {
  const s = p.spinner();
  s.start("Ensuring Bun…");
  const bunResult = await ensureBun();
  if ("error" in bunResult) {
    s.stop("Bun check failed.");
    console.error(pc.red(bunResult.error));
    return 1;
  }
  s.stop("Bun ready.");

  s.start("Reinstalling dependencies and rebuilding…");
  const installRes = await runStreaming(bunResult.bunBin, ["install"], {
    cwd: existing.installDir,
  });
  const buildRes =
    installRes.code === 0
      ? await runStreaming(bunResult.bunBin, ["run", "build"], { cwd: existing.installDir })
      : installRes;
  if (buildRes.code !== 0) {
    s.stop("Build failed.");
    return 1;
  }
  s.stop("Rebuilt.");

  s.start("Re-rendering and re-bootstrapping services…");
  const labels = resolveServiceLabels(existing);
  installServiceFiles(existing.installDir, resolveRoot(existing), labels);
  const bootstrap = await bootstrapAndStart(labels);
  s.stop(
    bootstrap.errors.length ? "Services re-registered with warnings." : "Services re-registered.",
  );
  for (const e of bootstrap.errors) console.error(pc.yellow(e));

  // Refresh the shared localhost-domain proxy too (0.2.3) — best-effort, never fails repair.
  if (await canBindPort80()) {
    const proxyResult = await installProxyService(existing.installDir);
    if (!proxyResult.ok)
      console.error(
        pc.yellow(`Localhost-domain proxy refresh had a warning: ${proxyResult.error}`),
      );
  }

  s.start("Health check…");
  const health = await waitForHealthy(existing.webPort, existing.vaultPort);
  s.stop(health.healthy ? "Healthy." : "Health check timed out.");
  if (!health.healthy) {
    console.error(
      pc.red(
        formatHealthTimeoutDiagnostics(resolveRoot(existing), (p) => lastLines(p, 10), logPathFor),
      ),
    );
    console.error(pc.dim("\nFull logs: arelos logs"));
  }
  return health.healthy ? 0 : 1;
}
