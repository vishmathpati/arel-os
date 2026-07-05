/**
 * `rlo update` (spec §2). git pull --ff-only + bun install/build + restart +
 * re-health-check. Config file untouched.
 */
import pc from "picocolors";
import { ensureBun } from "./bun-setup.js";
import type { ArelConfig } from "./config.js";
import { readConfig } from "./config.js";
import { runStreaming } from "./exec.js";
import { waitForHealthy } from "./health.js";
import { pullLatest } from "./repo.js";
import { bootstrapAndStart, installServiceFiles } from "./services.js";

export async function updateCommand(): Promise<number> {
  const config = readConfig();
  if (!config) {
    console.error("No Arel OS install found. Run `npx arelos` to install.");
    return 1;
  }
  return runUpdate(config);
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
  const buildRes = await runStreaming(bunResult.bunBin, ["run", "build"], { cwd: config.installDir });
  if (buildRes.code !== 0) {
    console.warn(pc.yellow("bun run build failed — keeping old dist/. The web service will keep serving it."));
  }

  installServiceFiles(config.installDir);
  const bootstrap = await bootstrapAndStart();
  for (const e of bootstrap.errors) console.error(pc.yellow(e));

  console.log("Restarting services and re-checking health…");
  const health = await waitForHealthy(config.webPort, config.vaultPort);
  if (!health.healthy) {
    console.error(pc.red("Health check timed out after update. Run `arelos logs`."));
    return 1;
  }
  console.log(pc.green("Update complete. Arel OS is healthy."));
  return 0;
}
