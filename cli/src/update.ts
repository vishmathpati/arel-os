/**
 * `arelos update`. git pull --ff-only + bun install/build + restart +
 * re-health-check. Config file untouched. With multiple installs registered,
 * resolves by name (or prompts/lists per resolveInstall's rule).
 */
import pc from "picocolors";
import { ensureBun } from "./bun-setup.js";
import { resolveInstall } from "./cli-context.js";
import type { ArelConfig } from "./config.js";
import { resolveRoot, resolveServiceLabels } from "./config.js";
import { runStreaming } from "./exec.js";
import { waitForHealthy } from "./health.js";
import { canBindPort80, installProxyService } from "./proxy-service.js";
import { pullLatest } from "./repo.js";
import { bootstrapAndStart, installServiceFiles } from "./services.js";

export async function updateCommand(name?: string | null): Promise<number> {
  const result = await resolveInstall({ name, interactive: process.stdout.isTTY === true });
  if (!result.ok) {
    console.error(result.message);
    return 1;
  }
  return runUpdate(result.install.config);
}

export async function runUpdate(config: ArelConfig): Promise<number> {
  console.log(`Updating ${config.installDir}…`);
  const pull = await pullLatest(config.installDir);
  if (pull.dirty) {
    console.error(
      pc.red(
        "Working tree has uncommitted changes — refusing to pull. Run `git -C " +
          `${config.installDir} stash` +
          "` first.",
      ),
    );
    return 1;
  }
  if (pull.code !== 0) {
    console.error(pc.red(`git pull failed: ${pull.stderr}`));
    return 1;
  }

  const bunResult = await ensureBun();
  if ("error" in bunResult) {
    console.error(pc.red(bunResult.error));
    return 1;
  }

  const installRes = await runStreaming(bunResult.bunBin, ["install"], { cwd: config.installDir });
  if (installRes.code !== 0) {
    console.error(pc.red("bun install failed."));
    return 1;
  }
  const buildRes = await runStreaming(bunResult.bunBin, ["run", "build"], {
    cwd: config.installDir,
  });
  if (buildRes.code !== 0) {
    console.warn(
      pc.yellow("bun run build failed — keeping old dist/. The web service will keep serving it."),
    );
  }

  const labels = resolveServiceLabels(config);
  installServiceFiles(config.installDir, resolveRoot(config), labels);
  const bootstrap = await bootstrapAndStart(labels);
  for (const e of bootstrap.errors) console.error(pc.yellow(e));

  // Refresh the shared localhost-domain proxy too (0.2.3) — it's rewritten by
  // whichever install runs update/repair last, so it always reflects the
  // current CLI version. Best-effort: never fails the update.
  if (await canBindPort80()) {
    const proxyResult = await installProxyService(config.installDir);
    if (!proxyResult.ok)
      console.warn(pc.yellow(`Localhost-domain proxy refresh had a warning: ${proxyResult.error}`));
  }

  console.log("Restarting services and re-checking health…");
  const health = await waitForHealthy(config.webPort, config.vaultPort);
  if (!health.healthy) {
    console.error(pc.red("Health check timed out after update. Run `arelos logs`."));
    return 1;
  }
  console.log(pc.green("Update complete. Arel OS is healthy."));
  return 0;
}
