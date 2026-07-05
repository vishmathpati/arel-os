/**
 * HTTP health probes for the vault (`/config`) and web (`/`) services
 * (used by `arelos install` and `arelos status`). Pure fetch-based, no deps.
 */

export interface VaultHealth {
  up: boolean;
  displayName?: string;
  vaultPort?: number;
  error?: string;
}

export interface WebHealth {
  up: boolean;
  status?: number;
  error?: string;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function checkVaultHealth(vaultPort: number, timeoutMs = 3000): Promise<VaultHealth> {
  try {
    const res = await fetchWithTimeout(`http://localhost:${vaultPort}/config`, timeoutMs);
    if (!res.ok) return { up: false, error: `HTTP ${res.status}` };
    const body = (await res.json()) as { displayName?: string; vaultPort?: number };
    return { up: true, displayName: body.displayName, vaultPort: body.vaultPort };
  } catch (err) {
    return { up: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkWebHealth(webPort: number, timeoutMs = 3000): Promise<WebHealth> {
  try {
    const res = await fetchWithTimeout(`http://localhost:${webPort}/`, timeoutMs);
    return { up: res.ok, status: res.status };
  } catch (err) {
    return { up: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Poll both services until healthy or timeout. Used post-install/update
 * (spec §1 Step 12): vault must serve /config with the right port, web must
 * return 200/HTML. The web service runs a full build on first start, so the
 * default timeout is generous.
 */
export async function waitForHealthy(
  webPort: number,
  vaultPort: number,
  opts: { timeoutMs?: number; intervalMs?: number; onTick?: (elapsedMs: number) => void } = {},
): Promise<{ healthy: boolean; vault: VaultHealth; web: WebHealth }> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const intervalMs = opts.intervalMs ?? 1500;
  const start = Date.now();

  let vault: VaultHealth = { up: false };
  let web: WebHealth = { up: false };

  while (Date.now() - start < timeoutMs) {
    vault = await checkVaultHealth(vaultPort);
    web = await checkWebHealth(webPort);
    opts.onTick?.(Date.now() - start);
    if (vault.up && vault.vaultPort === vaultPort && web.up) {
      return { healthy: true, vault, web };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { healthy: false, vault, web };
}

/**
 * Known failure signatures we can recognize in a service log tail and turn
 * into an actionable hint, rather than making the user go read logs
 * themselves. Field bug: a health-check timeout with just "check logs" left
 * a real user stuck on a TCC crash-loop (`Operation not permitted`, exit 126)
 * with no idea what was wrong. Order matters — first match wins.
 */
export interface LogSignatureHint {
  /** Substring (case-insensitive) to look for in the log tail. */
  pattern: string;
  hint: string;
}

export const LOG_SIGNATURE_HINTS: LogSignatureHint[] = [
  {
    pattern: "operation not permitted",
    hint:
      "This looks like macOS's TCC privacy protection: background services can't run from " +
      "Desktop, Documents, Downloads, or iCloud Drive. Move the install to a folder in your home " +
      "directory (e.g. ~/arelos) and reinstall.",
  },
  {
    pattern: "eaddrinuse",
    hint:
      "This looks like a port conflict: another process is already using the configured port. " +
      "Free the port or re-run install with a different --web-port/--vault-port.",
  },
  {
    pattern: "address already in use",
    hint:
      "This looks like a port conflict: another process is already using the configured port. " +
      "Free the port or re-run install with a different --web-port/--vault-port.",
  },
  {
    pattern: "command not found",
    hint: "This looks like a missing dependency on PATH inside the launchd environment. Check the service's shebang/interpreter is installed and resolvable without a login shell.",
  },
];

/**
 * Match a log tail against known failure signatures. Pure string matching,
 * no I/O — unit-testable without touching disk. Returns null when nothing
 * recognized matches, so callers can fall back to a generic message.
 */
export function matchLogSignature(logTail: string): LogSignatureHint | null {
  const lower = logTail.toLowerCase();
  for (const entry of LOG_SIGNATURE_HINTS) {
    if (lower.includes(entry.pattern)) return entry;
  }
  return null;
}

/**
 * Build the full health-timeout diagnostic message: last N lines of both
 * service logs, plus a targeted hint when a known failure signature is
 * found in either. `readTail` is injected so this stays pure/testable
 * (no direct fs access) while install.ts/repair.ts wire in the real reader.
 */
export function formatHealthTimeoutDiagnostics(
  logsRoot: string,
  readTail: (logPath: string) => string,
  logPathFor: (logsRoot: string, which: "web" | "vault") => string,
): string {
  const webLogPath = logPathFor(logsRoot, "web");
  const vaultLogPath = logPathFor(logsRoot, "vault");
  const webTail = readTail(webLogPath);
  const vaultTail = readTail(vaultLogPath);

  const hint = matchLogSignature(webTail) ?? matchLogSignature(vaultTail);

  const lines = [
    "App did not come up in time.",
    "",
    `-- last lines of ${webLogPath} --`,
    webTail.trim() || "(empty)",
    "",
    `-- last lines of ${vaultLogPath} --`,
    vaultTail.trim() || "(empty)",
  ];
  if (hint) {
    lines.push("", hint.hint);
  }
  return lines.join("\n");
}
