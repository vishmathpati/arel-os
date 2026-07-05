/**
 * Minimal hand-rolled arg parsing — no dep needed for this surface.
 * The spec doesn't define a non-interactive mode; this adds one per the
 * task's testing requirement (--yes/--defaults + --no-service + --local-repo).
 */
export interface InstallFlags {
  yes: boolean;
  noService: boolean;
  localRepo: string | null;
  displayName: string | null;
  installDir: string | null;
  vaultPath: string | null;
  webPort: number | null;
  vaultPort: number | null;
}

export function parseInstallFlags(argv: string[]): InstallFlags {
  const flags: InstallFlags = {
    yes: false,
    noService: false,
    localRepo: null,
    displayName: null,
    installDir: null,
    vaultPath: null,
    webPort: null,
    vaultPort: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--yes":
      case "--defaults":
        flags.yes = true;
        break;
      case "--no-service":
        flags.noService = true;
        break;
      case "--local-repo":
        flags.localRepo = argv[++i] ?? null;
        break;
      case "--display-name":
        flags.displayName = argv[++i] ?? null;
        break;
      case "--install-dir":
        flags.installDir = argv[++i] ?? null;
        break;
      case "--vault-path":
        flags.vaultPath = argv[++i] ?? null;
        break;
      case "--web-port":
        flags.webPort = Number(argv[++i]);
        break;
      case "--vault-port":
        flags.vaultPort = Number(argv[++i]);
        break;
      default:
        break;
    }
  }
  return flags;
}

export interface LogsFlags {
  which: "web" | "vault" | "both";
  follow: boolean;
  lines: number;
}

export function parseLogsFlags(argv: string[]): LogsFlags {
  let which: LogsFlags["which"] = "both";
  let follow = false;
  let lines = 100;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "web" || arg === "vault") which = arg;
    else if (arg === "-f" || arg === "--follow") follow = true;
    else if (arg === "-n") lines = Number(argv[++i]) || 100;
    else if (arg.startsWith("-n=")) lines = Number(arg.slice(3)) || 100;
  }
  return { which, follow, lines };
}
