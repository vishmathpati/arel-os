/**
 * Interactive + non-interactive install flow. 0.2.0 owner-directed redesign:
 * one required question (name), an optional location override (default: your
 * home directory), silent auto-picked ports, then a summary + confirm. Every
 * install is self-contained under `<parent>/<slug>` — see install-plan.ts.
 */
import * as p from "@clack/prompts";
import pc from "picocolors";
import { ensureBun } from "./bun-setup.js";
import type { InstallFlags } from "./cli-args.js";
import { readConfigAt, writeConfig } from "./config.js";
import { runStreaming } from "./exec.js";
import { formatHealthTimeoutDiagnostics, waitForHealthy } from "./health.js";
import {
  DEFAULTS,
  type InstallAnswers,
  TCC_PROTECTED_PATH_MESSAGE,
  appDirFor,
  checkRootDir,
  defaultParentDir,
  normalizeDisplayName,
  resolvePort,
  rootFor,
  slugOrFallback,
  toArelConfig,
  vaultPathFor,
} from "./install-plan.js";
import { listLoadedArelosLabels } from "./launchd.js";
import { lastLines, logPathFor } from "./logs.js";
import { installConfigPath, isTccProtectedPath } from "./paths.js";
import { canBindPort80, installProxyService } from "./proxy-service.js";
import { domainFor } from "./proxy.js";
import { addRegistryEntry } from "./registry.js";
import { runRepairMenu } from "./repair.js";
import { cloneRepo, isGitCheckout } from "./repo.js";
import {
  TemplateVaultMissingError,
  ensureEnvFile,
  ensureLogsDir,
  scaffoldVault,
} from "./scaffold.js";
import { bootstrapAndStart, installServiceFiles } from "./services.js";

export async function runInstall(argv: string[], flags: InstallFlags): Promise<number> {
  // Step 0 — Preflight & existing-install detection.
  if (process.platform !== "darwin") {
    console.error("Arel OS currently supports macOS only.");
    return 1;
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

  // A prior install of the *same name* (same resolved root, already a git
  // checkout at root/app) is a repair, not a fresh install — never silently
  // reinstall over it.
  const rootCheck = checkRootDir(answers.root);
  if (rootCheck.isPriorArelosInstall) {
    const existingConfig = readConfigAt(answers.root);
    if (existingConfig) {
      if (!flags.yes) {
        return runRepairMenu(existingConfig);
      }
      console.log(pc.yellow(`Existing install detected at ${answers.root}; repairing.`));
    }
  }

  if (!flags.yes) {
    p.note(
      [
        `Name:        ${answers.displayName}`,
        `Location:    ${answers.root}`,
        `  app:       ${answers.installDir}`,
        `  vault:     ${answers.vaultPath}`,
        `  logs:      ${answers.root}/logs/service`,
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

  // Step 8 — Get the app source into root/app.
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

  // Logs live at the self-contained root, not inside the app checkout.
  ensureLogsDir(answers.root);
  const envResult = ensureEnvFile(installDir);
  log(
    flags.yes,
    envResult.created ? "Wrote .env from .env.example." : ".env already present; left untouched.",
  );

  // Step 10 — Write per-install config to <root>/config.json + register.
  const config = toArelConfig(answers);
  const cfgPath = installConfigPath(config.root);
  writeConfig(config, cfgPath);
  log(flags.yes, `Config written to ${cfgPath}.`);

  addRegistryEntry({
    name: answers.displayName,
    slug: slugOrFallback(answers.displayName),
    root: config.root,
    createdAt: new Date().toISOString(),
  });

  if (flags.noService) {
    log(flags.yes, "Skipping launchd bootstrap (--no-service).");
    p.outro(pc.green("Dry-run install complete (no services started)."));
    return 0;
  }

  // Step 10.5 — Preflight: check for a same-slug reinstall vs. an unrelated
  // Arel OS install already holding other com.arelos.* labels.
  const labels = config.serviceLabels;
  const loadedLabels = await listLoadedArelosLabels();
  const oursAlreadyLoaded = loadedLabels.filter((l) => l === labels.web || l === labels.vault);
  const othersLoaded = loadedLabels.filter((l) => l !== labels.web && l !== labels.vault);
  if (oursAlreadyLoaded.length > 0) {
    log(
      flags.yes,
      `Services for this install are already loaded (${oursAlreadyLoaded.join(", ")}) — will bootout and re-bootstrap.`,
    );
  }
  if (othersLoaded.length > 0) {
    console.error(
      pc.yellow(
        `Another Arel OS install is already running with its own services (${othersLoaded.join(", ")}). ` +
          "This install uses its own unique labels, so it will not disturb that install.",
      ),
    );
  }

  // Step 11 — Generate + bootstrap launchd services.
  const svcSpin = spinner(flags.yes);
  svcSpin.start("Registering background services…");
  installServiceFiles(installDir, config.root, labels);
  const bootstrapResult = await bootstrapAndStart(labels);
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
      pc.red(formatHealthTimeoutDiagnostics(config.root, (p) => lastLines(p, 10), logPathFor)),
    );
    console.error(pc.dim("\nFull logs: arelos logs"));
    return 1;
  }
  healthSpin.stop("App is up.");

  // Step 12.5 — Localhost domain (0.2.3): give this (and every) install a
  // http://<slug>.localhost address via the one shared proxy service, but
  // only when port 80 is actually available on this Mac — never fight
  // something else for it (checked fresh, never assumed; see proxy-service.ts).
  const slug = slugOrFallback(answers.displayName);
  let domainLine: string | null = null;
  if (!flags.noService) {
    const canBind = await canBindPort80();
    if (canBind) {
      const proxyResult = await installProxyService(installDir);
      if (proxyResult.ok) {
        domainLine = `${answers.displayName} is running at http://${domainFor(slug)} (also http://localhost:${config.webPort})`;
      } else {
        log(
          flags.yes,
          `Note: could not start the shared localhost-domain proxy (${proxyResult.error}). Using the port URL below instead.`,
        );
      }
    } else {
      log(
        flags.yes,
        "Note: port 80 is in use by something else on this Mac — skipping the http://<name>.localhost shortcut; the port URL below still works.",
      );
    }
  }

  // Step 13 — Open browser.
  const url = `http://localhost:${config.webPort}`;
  const openUrl = domainLine ? `http://${domainFor(slug)}` : url;
  if (!flags.yes) {
    try {
      await runStreaming("open", [openUrl]);
    } catch {
      // best-effort
    }
  }
  p.outro(
    [
      pc.green(domainLine ?? `${answers.displayName} is running at ${url}`),
      "Runs 24/7 in the background.",
      "Next: arelos status · arelos logs · arelos update · arelos uninstall",
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
    const root = flags.root ?? rootFor(flags.parentDir ?? defaultParentDir(), displayName);
    if (isTccProtectedPath(root)) {
      console.error(
        pc.red(`Install location ${root} is not safe to use: ${TCC_PROTECTED_PATH_MESSAGE}`),
      );
      return null;
    }
    const check = checkRootDir(root);
    if (check.nonEmpty && !check.isPriorArelosInstall) {
      console.error(
        pc.red(
          `${check.path} already has files in it and isn't a prior Arel OS install — choose a different name or location.`,
        ),
      );
      return null;
    }
    const installDir = appDirFor(root);
    const vaultPath = vaultPathFor(root);
    const webPortReq = flags.webPort ?? DEFAULTS.webPort;
    const vaultPortReq = flags.vaultPort ?? DEFAULTS.vaultPort;
    const web = await resolvePort(webPortReq);
    const vault = await resolvePort(
      vaultPortReq === web.resolved ? vaultPortReq + 1 : vaultPortReq,
    );
    return {
      displayName,
      root,
      installDir,
      vaultPath,
      webPort: web.resolved,
      vaultPort: vault.resolved,
    };
  }

  // Step 2 — Name your system (the single required question).
  const displayNameRaw = await p.text({
    message: "What should we call your system?",
    placeholder: DEFAULTS.displayName,
    defaultValue: DEFAULTS.displayName,
  });
  if (p.isCancel(displayNameRaw)) return null;
  const displayName = normalizeDisplayName(String(displayNameRaw));
  const slug = slugOrFallback(displayName);

  p.log.message(
    `We'll create everything in ~/${slug} — the app, your vault, and logs all live inside this one folder.`,
  );

  // Step 3 — Change location? (default No — we always create <parent>/<slug>, never install loose.)
  let parentDir = defaultParentDir();
  const changeLocation = await p.confirm({ message: "Change location?", initialValue: false });
  if (p.isCancel(changeLocation)) return null;
  if (changeLocation) {
    const raw = await p.text({
      message: "Parent folder to install into (we'll create the app's folder inside it):",
      placeholder: defaultParentDir(),
      defaultValue: defaultParentDir(),
    });
    if (p.isCancel(raw)) return null;
    parentDir = String(raw || defaultParentDir());
  }

  let root = "";
  for (;;) {
    const candidateRoot = rootFor(parentDir, displayName);
    const check = checkRootDir(candidateRoot);
    if (check.isTccProtected) {
      p.log.error(
        `${TCC_PROTECTED_PATH_MESSAGE} (suggested: ${rootFor(defaultParentDir(), displayName)})`,
      );
      const raw = await p.text({
        message: "Parent folder to install into:",
        placeholder: defaultParentDir(),
        defaultValue: defaultParentDir(),
      });
      if (p.isCancel(raw)) return null;
      parentDir = String(raw || defaultParentDir());
      continue;
    }
    if (!check.parentWritable) {
      p.log.error(`Cannot write to ${check.path} — choose another location.`);
      const raw = await p.text({ message: "Parent folder to install into:" });
      if (p.isCancel(raw)) return null;
      parentDir = String(raw);
      continue;
    }
    if (check.nonEmpty && !check.isPriorArelosInstall) {
      const choice = await p.select({
        message: `${check.path} already has files in it and isn't a prior install named "${displayName}".`,
        options: [
          { value: "name", label: "Choose a different name" },
          { value: "location", label: "Choose a different location" },
          { value: "cancel", label: "Cancel install" },
        ],
      });
      if (p.isCancel(choice) || choice === "cancel") return null;
      if (choice === "location") {
        const raw = await p.text({ message: "Parent folder to install into:" });
        if (p.isCancel(raw)) return null;
        parentDir = String(raw);
        continue;
      }
      // choice === "name": re-ask for a name, keep the same parentDir.
      const nameRaw = await p.text({
        message: "What should we call your system?",
        placeholder: DEFAULTS.displayName,
        defaultValue: DEFAULTS.displayName,
      });
      if (p.isCancel(nameRaw)) return null;
      return collectAnswersFromName(normalizeDisplayName(String(nameRaw)), parentDir);
    }
    root = check.path;
    break;
  }

  return finalizeAnswers(displayName, root);
}

/** Re-entry point when the user picks "choose a different name" mid-flow (avoids re-asking location). */
async function collectAnswersFromName(
  displayName: string,
  parentDir: string,
): Promise<InstallAnswers | null> {
  for (;;) {
    const candidateRoot = rootFor(parentDir, displayName);
    const check = checkRootDir(candidateRoot);
    if (check.isTccProtected) {
      p.log.error(TCC_PROTECTED_PATH_MESSAGE);
      return null;
    }
    if (check.nonEmpty && !check.isPriorArelosInstall) {
      p.log.error(`${check.path} also already has files in it — try a different name.`);
      const nameRaw = await p.text({ message: "What should we call your system?" });
      if (p.isCancel(nameRaw)) return null;
      displayName = normalizeDisplayName(String(nameRaw));
      continue;
    }
    return finalizeAnswers(displayName, check.path);
  }
}

/** Auto-pick free ports silently and assemble the final InstallAnswers. */
async function finalizeAnswers(displayName: string, root: string): Promise<InstallAnswers> {
  const installDir = appDirFor(root);
  const vaultPath = vaultPathFor(root);
  const web = await resolvePort(DEFAULTS.webPort);
  const vault = await resolvePort(
    DEFAULTS.vaultPort === web.resolved ? DEFAULTS.vaultPort + 1 : DEFAULTS.vaultPort,
  );
  return {
    displayName,
    root,
    installDir,
    vaultPath,
    webPort: web.resolved,
    vaultPort: vault.resolved,
  };
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
