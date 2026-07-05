#!/usr/bin/env node
/**
 * rlo — the Arel OS installer/service manager. `npx rlo` with no subcommand
 * runs the interactive install flow (rlo-cli-spec.md §1).
 */
if (process.platform !== "darwin") {
  console.error("Arel OS currently supports macOS only.");
  process.exit(1);
}

import { parseInstallFlags, parseLogsFlags } from "./cli-args.js";
import { runInstall } from "./install.js";
import { logsCommand } from "./logs.js";
import { statusCommand } from "./status.js";
import { uninstallCommand } from "./uninstall.js";
import { updateCommand } from "./update.js";

async function main(): Promise<number> {
  const argv = process.argv.slice(2);

  if (argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    printHelp();
    return 0;
  }

  // No subcommand given, or the first token is a flag (e.g. `rlo --yes ...`)
  // rather than a subcommand name — both mean "install". Anything else in
  // the known set consumes its name as the subcommand; everything after it
  // is passed through as that subcommand's own args.
  const knownSubcommands = new Set(["install", "status", "update", "uninstall", "logs"]);
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
    case "status":
      return statusCommand();
    case "update":
      return updateCommand();
    case "uninstall":
      return uninstallCommand();
    case "logs":
      return logsCommand(parseLogsFlags(rest));
    default:
      console.error(`Unknown command: ${subcommand}\n`);
      printHelp();
      return 1;
  }
}

function printHelp(): void {
  console.log(`rlo — install and manage a self-hosted Arel OS

Usage:
  npx rlo                 Install (interactive)
  rlo status               Show install + service status
  rlo update                git pull + rebuild + restart
  rlo uninstall             Stop services, optionally remove install dir / vault
  rlo logs [web|vault]      Tail service logs (-f to follow, -n <N> for line count)

Install flags (non-interactive):
  --yes, --defaults        Skip prompts, use defaults/flags below
  --display-name <name>
  --install-dir <path>
  --vault-path <path>
  --web-port <port>
  --vault-port <port>
  --no-service              Skip launchd bootstrap (for dry runs / development)
  --local-repo <path>       Use a local path instead of cloning from GitHub
`);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  });
