/**
 * Interactive + non-interactive install flow (rlo-cli-spec.md §1).
 * Steps are numbered in comments to match the spec exactly.
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ensureBun, MANUAL_BUN_INSTALL_HINT } from "./bun-setup.js";
import type { InstallFlags } from "./cli-args.js";
import { readConfig, writeConfig } from "./config.js";
import { runStreaming } from "./exec.js";
import { waitForHealthy } from "./health.js";
import {
  checkInstallDir,
  defaultVaultPath,
  DEFAULTS,
  normalizeDisplayName,
  resolvePort,
  toArelConfig,
  type InstallAnswers,
} from "./install-plan.js";
import { bootstrapAndStart, installServiceFiles } from "./services.js";
import { cloneRepo, isGitCheckout } from "./repo.js";
import { ensureEnvFile, ensureLogsDir, scaffoldVault, TemplateVaultMissingError } from "./scaffold.js";
import { runRepairMenu } from "./repair.js";
import { configPath } from "./paths.js";

export async function runInstall(argv: string[], flags: InstallFlags): Promise<number> {
  // Step 0 — Preflight & existing-install detection.
  if (process.platform !== "darwin") {
    console.error("Arel OS currently supports macOS only.");
    return 1;
  }

  const existing = readConfig();
  if (existing && !flags.yes) {
    return runRepairMenu(existing);
  }
  if (existing && flags.yes) {
    // Non-interactive re-run against an existing install: treat as repair to
    // stay consistent with "never silently reinstall" (spec §3.1), unless the
    // caller explicitly pointed at a fresh installDir/config.
    console.log(pc.yellow(`Existing install detected at ${existing.installDir}; repairing.`));
  }

  const gitOk = flags.localRepo ? true : await checkGit();
  if (!gitOk) return 1;

  p.intro(pc.bold("Arel OS — your personal life-OS, self-hosted on your Mac."));
  if (!flags.yes) {
    p.log.message(
      "This installs Arel OS to a folder, runs two background services, and opens it in your browser.\nMIT licensed. Everything stays local on this Mac.",
    );
  }

  const answers = await collectAnswers(flags);
  if (answers === null) {
    p.cancel("Install cancelled.");
    return 1;
  }

  if (!flags.yes) {
    p.note(
      [
        `Name:        ${answers.displayName}`,
        `Install dir: ${answers.installDir}`,
        `Vault path:  ${answers.vaultPath}`,
        `Web port:    ${answers.webPort}`,
        `Vault port:  ${answers.vaultPort}`,
      ].join("\n"),
      "Summary",
    );
    const proceed = await p.confirm({ message: "Proceed with install?", initialValue: true });
    if (p.isCancel(proceed) || !proceed) {
      p.cancel("Install cancelled.");
      return 1;
    }
  }

  // Step 7 — Install Bun if missing.
  const bunSpin = spinner(flags.yes);
  bunSpin.start("Checking for Bun…");
  const bunResult = await ensureBun();
  if ("error" in bunResult) {
    bunSpin.stop("Bun setup failed.");
    console.error(pc.red(bunResult.error));
    return 1;
  }
  bunSpin.stop(`Bun ready (${bunResult.bunBin}).`);

  // Step 8 — Get the app source.
  const installDir = answers.installDir;
  if (isGitCheckout(installDir)) {
    log(flags.yes, `Existing checkout found at ${installDir}; skipping clone.`);
  } else {
    const cloneSpin = spinner(flags.yes);
    cloneSpin.start(`Cloning app source into ${installDir}…`);
    const cloneRes = await cloneRepo(installDir, { sourcePath: flags.localRepo ?? undefined });
    if (cloneRes.code !== 0) {
      cloneSpin.stop("Clone failed.");
      console.error(pc.red(cloneRes.stderr));
      return 1;
    }
    cloneSpin.stop("App source cloned.");
  }

  // Step 9 — Build + scaffold.
  const buildSpin = spinner(flags.yes);
  buildSpin.start("Installing dependencies (bun install)…");
  const installRes = await runStreaming(bunResult.bunBin, ["install"], { cwd: installDir });
  if (installRes.code !== 0) {
    buildSpin.stop("bun install failed.");
    return 1;
  }
  buildSpin.stop("Dependencies installed.");

  const buildSpin2 = spinner(flags.yes);
  buildSpin2.start("Building the app (bun run build)…");
  const buildRes = await runStreaming(bunResult.bunBin, ["run", "build"], { cwd: installDir });
  if (buildRes.code !== 0) {
    buildSpin2.stop("Build failed — services will not be registered.");
    return 1;
  }
  buildSpin2.stop("Build complete.");

  try {
    const scaffoldResult = scaffoldVault(installDir, answers.vaultPath);
    log(
      flags.yes,
      scaffoldResult.copied
        ? `Vault scaffolded at ${answers.vaultPath}.`
        : `Vault at ${answers.vaultPath} already has content; left untouched.`,
    );
  } catch (err) {
    if (err instanceof TemplateVaultMissingError) {
      console.error(pc.red(err.message));
      return 1;
    }
    throw err;
  }

  ensureLogsDir(installDir);
  const envResult = ensureEnvFile(installDir);
  log(flags.yes, envResult.created ? "Wrote .env from .env.example." : ".env already present; left untouched.");

  // Step 10 — Write config.
  const config = toArelConfig(answers);
  writeConfig(config);
  log(flags.yes, `Config written to ${configPath()}.`);

  if (flags.noService) {
    log(flags.yes, "Skipping launchd bootstrap (--no-service).");
    p.outro(pc.green("Dry-run install complete (no services started)."));
    return 0;
  }

  // Step 11 — Generate + bootstrap launchd services.
  const svcSpin = spinner(flags.yes);
  svcSpin.start("Registering background services…");
  installServiceFiles(installDir);
  const bootstrapResult = await bootstrapAndStart();
  if (bootstrapResult.errors.length > 0) {
    svcSpin.stop("Service registration had errors.");
    for (const e of bootstrapResult.errors) console.error(pc.yellow(e));
  } else {
    svcSpin.stop("Services registered and started.");
  }

  // Step 12 — Health check.
  const healthSpin = spinner(flags.yes);
  healthSpin.start("Waiting for the app to come up (building the dashboard…)");
  const health = await waitForHealthy(config.webPort, config.vaultPort);
  if (!health.healthy) {
    healthSpin.stop("Health check timed out.");
    console.error(
      pc.red(
        `App did not come up in time. Check logs:\n  rlo logs\n  ${join(installDir, "logs/service/web.log")}\n  ${join(installDir, "logs/service/vault.log")}`,
      ),
    );
    return 1;
  }
  healthSpin.stop("App is up.");

  // Step 13 — Open browser.
  const url = `http://localhost:${config.webPort}`;
  if (!flags.yes) {
    try {
      await runStreaming("open", [url]);
    } catch {
      // best-effort
    }
  }
  p.outro(
    [
      pc.green(`Arel OS is running at ${url}`),
      "Runs 24/7 in the background.",
      "Next: rlo status · rlo logs · rlo update · rlo uninstall",
    ].join("\n"),
  );
  return 0;
}

async function checkGit(): Promise<boolean> {
  const { commandExists } = await import("./exec.js");
  if (commandExists("git")) return true;
  console.error(
    "git is required but was not found. Install Xcode Command Line Tools:\n  xcode-select --install",
  );
  return false;
}

async function collectAnswers(flags: InstallFlags): Promise<InstallAnswers | null> {
  if (flags.yes) {
    const displayName = normalizeDisplayName(flags.displayName ?? DEFAULTS.displayName);
    const installDir = flags.installDir ?? DEFAULTS.installDir;
    const vaultPath = flags.vaultPath ?? defaultVaultPath(installDir);
    const webPortReq = flags.webPort ?? DEFAULTS.webPort;
    const vaultPortReq = flags.vaultPort ?? DEFAULTS.vaultPort;
    const web = await resolvePort(webPortReq);
    const vault = await resolvePort(vaultPortReq === web.resolved ? vaultPortReq + 1 : vaultPortReq);
    return {
      displayName,
      installDir,
      vaultPath,
      webPort: web.resolved,
      vaultPort: vault.resolved,
    };
  }

  // Step 2 — Name your system.
  const displayNameRaw = await p.text({
    message: "What should we call your system?",
    placeholder: DEFAULTS.displayName,
    defaultValue: DEFAULTS.displayName,
  });
  if (p.isCancel(displayNameRaw)) return null;

  // Step 3 — Install location.
  let installDir = "";
  for (;;) {
    const raw = await p.text({
      message: "Where should Arel OS be installed?",
      placeholder: DEFAULTS.installDir,
      defaultValue: DEFAULTS.installDir,
    });
    if (p.isCancel(raw)) return null;
    const check = checkInstallDir(String(raw || DEFAULTS.installDir));
    if (!check.parentWritable) {
      p.log.error(`Cannot write to ${check.path} — choose another location.`);
      continue;
    }
    if (check.nonEmpty && !check.isPriorArelosInstall) {
      const proceed = await p.confirm({
        message: `${check.path} exists and is not empty. Use it anyway?`,
        initialValue: false,
      });
      if (p.isCancel(proceed) || !proceed) continue;
    }
    installDir = check.path;
    break;
  }

  // Step 4 — Vault location.
  const vaultRaw = await p.text({
    message: "Where's your vault (notes/tasks/quests)?",
    placeholder: defaultVaultPath(installDir),
    defaultValue: defaultVaultPath(installDir),
  });
  if (p.isCancel(vaultRaw)) return null;

  // Step 5 — Ports.
  const webPort = await promptPort("Web port?", DEFAULTS.webPort);
  if (webPort === null) return null;
  const vaultPort = await promptPort("Vault port?", DEFAULTS.vaultPort === webPort ? DEFAULTS.vaultPort + 1 : DEFAULTS.vaultPort);
  if (vaultPort === null) return null;

  return {
    displayName: normalizeDisplayName(String(displayNameRaw)),
    installDir,
    vaultPath: String(vaultRaw || defaultVaultPath(installDir)),
    webPort,
    vaultPort,
  };
}

async function promptPort(message: string, defaultPort: number): Promise<number | null> {
  let candidate = defaultPort;
  for (;;) {
    const resolution = await resolvePort(candidate);
    let suggested = resolution.resolved;
    if (!resolution.wasFree) {
      p.log.warn(`Port ${resolution.requested} is in use — suggesting ${suggested}.`);
    }
    const raw = await p.text({
      message,
      placeholder: String(suggested),
      defaultValue: String(suggested),
    });
    if (p.isCancel(raw)) return null;
    const parsed = Number(raw || suggested);
    if (!Number.isInteger(parsed) || parsed <= 1023) {
      p.log.error("Enter a valid port number above 1023.");
      candidate = suggested;
      continue;
    }
    const check = await resolvePort(parsed);
    if (!check.wasFree) {
      candidate = check.resolved;
      continue;
    }
    return parsed;
  }
}

function spinner(quiet: boolean) {
  if (quiet) {
    return {
      start: (msg: string) => console.log(msg),
      stop: (msg: string) => console.log(msg),
    };
  }
  return p.spinner();
}

function log(quiet: boolean, msg: string) {
  if (quiet) console.log(msg);
  else p.log.message(msg);
}
