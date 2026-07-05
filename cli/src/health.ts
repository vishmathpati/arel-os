/**
 * HTTP health probes for the vault (`/config`) and web (`/`) services
 * (spec §1 Step 12, §2 rlo status). Pure fetch-based, no deps.
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
