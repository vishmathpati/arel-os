#!/usr/bin/env node
/**
 * arelos — the Arel OS installer/service manager. `npx arelos` with no subcommand
 * runs the interactive install flow. 0.2.0 supports multiple named,
 * self-contained installs on one Mac — status/update/logs/uninstall accept an
 * optional install name/slug (see cli-context.ts for the resolution rule).
 */
if (process.platform !== "darwin") {
  console.error("Arel OS currently supports macOS only.");
  process.exit(1);
}

import { parseInstallFlags, parseLogsFlags, parsePortsFlags } from "./cli-args.js";
import { runInstall } from "./install.js";
import { listCommand } from "./list.js";
import { logsCommand } from "./logs.js";
import { portsCommand } from "./ports-command.js";
import { statusCommand } from "./status.js";
import { uninstallCommand } from "./uninstall.js";
import { updateCommand } from "./update.js";

async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  if (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    printHelp();
    return 0;
  }

  // No subcommand given, or the first token is a flag (e.g. `arelos --yes ...`)
  // rather than a subcommand name — both mean "install". Anything else in
  // the known set consumes its name as the subcommand; everything after it
  // is passed through as that subcommand's own args.
  const knownSubcommands = new Set(["install", "status", "update", "uninstall", "logs", "list", "ports"]);
  const firstIsFlag = argv.length === 0 || argv[0].startsWith("-");
  const firstIsKnown = argv.length > 0 && knownSubcommands.has(argv[0]);

  if (!firstIsFlag && !firstIsKnown) {
    console.error(`Unknown command: ${argv[0]}\n`);
    printHelp();
    return 1;
  }

  const hasExplicitSubcommand = firstIsKnown;
  const subcommand = hasExplicitSubcommand ? argv[0] : "install";
  const rest = hasExplicitSubcommand ? argv.slice(1) : argv;

  switch (subcommand) {
    case "install":
      return runInstall(rest, parseInstallFlags(rest));
    case "list":
      return listCommand();
    case "status":
      return statusCommand(nameArgFrom(rest));
    case "update":
      return updateCommand(nameArgFrom(rest));
    case "uninstall":
      return uninstallCommand(nameArgFrom(rest));
    case "logs":
      return logsCommand(parseLogsFlags(rest), logsNameArgFrom(rest));
    case "ports":
      return portsCommand(parsePortsFlags(rest), nameArgFrom(rest));
    default:
      console.error(`Unknown command: ${subcommand}\n`);
      printHelp();
      return 1;
  }
}

/** The first non-flag positional arg, if any — the optional install name/slug. */
function nameArgFrom(args: string[]): string | null {
  return args.find((a) => !a.startsWith("-")) ?? null;
}

/**
 * `logs` has two possible positionals — the install name and the web/vault
 * target — in either order. The target is a fixed keyword, so anything else
 * non-flag (and not `-n`'s own value) is the name.
 */
function logsNameArgFrom(args: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("-")) {
      if (arg === "-n") i++; // skip -n's value
      continue;
    }
    if (arg === "web" || arg === "vault") continue;
    return arg;
  }
  return null;
}

function printHelp(): void {
  console.log(`arelos — install and manage a self-hosted Arel OS

Usage:
  npx arelos                     Install (interactive)
  arelos list                     List every install (name, root, ports, status)
  arelos status [name]            Show install + service status
  arelos update [name]             git pull + rebuild + restart
  arelos uninstall [name]          Stop services, optionally remove install dir / vault
  arelos logs [name] [web|vault]   Tail service logs (-f to follow, -n <N> for line count)
  arelos ports [name]              Change the web/vault ports (interactive, or via flags below)

[name] is only needed when you have more than one install; omit it with a
single install, or you'll be prompted to choose interactively.

Install flags (non-interactive):
  --yes, --defaults        Skip prompts, use defaults/flags below
  --display-name <name>
  --root <path>             Full override of the resolved install root
  --parent-dir <path>       Override the parent dir the app's folder is created in
  --web-port <port>
  --vault-port <port>
  --no-service              Skip launchd bootstrap (for dry runs / development)
  --local-repo <path>       Use a local path instead of cloning from GitHub

Ports flags (non-interactive):
  --web-port <port>         New web port (omit to keep current)
  --vault-port <port>       New vault port (omit to keep current)
`);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
