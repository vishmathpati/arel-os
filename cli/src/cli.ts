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
  const [, , subcommand, ...rest] = process.argv;

  switch (subcommand) {
    case undefined:
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
    case "--help":
    case "-h":
    case "help":
      printHelp();
      return 0;
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
