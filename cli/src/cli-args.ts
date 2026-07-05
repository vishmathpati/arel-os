/**
 * Minimal hand-rolled arg parsing — no dep needed for this surface.
 *
 * 0.2.0: the interactive flow no longer asks about vault path or ports
 * independently — everything lives under one self-contained `root`
 * (`<parent>/<slug>`) and ports are auto-picked. Non-interactive flags follow
 * suit: `--root` overrides the whole resolved root directly (mainly for
 * tests/dry-runs); `--parent-dir` overrides just the parent the slug gets
 * appended to (mirrors the interactive "change location?" step). Port
 * overrides remain since the mission keeps them as an escape hatch.
 */
export interface InstallFlags {
  yes: boolean;
  noService: boolean;
  localRepo: string | null;
  displayName: string | null;
  /** Full override of the resolved root (`<parent>/<slug>`) — mainly for tests. */
  root: string | null;
  /** Override of just the parent dir; the slug is still always appended. */
  parentDir: string | null;
  webPort: number | null;
  vaultPort: number | null;
}

export function parseInstallFlags(argv: string[]): InstallFlags {
  const flags: InstallFlags = {
    yes: false,
    noService: false,
    localRepo: null,
    displayName: null,
    root: null,
    parentDir: null,
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
      case "--root":
        flags.root = argv[++i] ?? null;
        break;
      case "--parent-dir":
        flags.parentDir = argv[++i] ?? null;
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

export interface PortsFlags {
  webPort: number | null;
  vaultPort: number | null;
}

export function parsePortsFlags(argv: string[]): PortsFlags {
  const flags: PortsFlags = { webPort: null, vaultPort: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--web-port") flags.webPort = Number(argv[++i]);
    else if (arg === "--vault-port") flags.vaultPort = Number(argv[++i]);
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
