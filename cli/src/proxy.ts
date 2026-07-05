/**
 * Pure routing logic for the shared `com.arelos.proxy` service (0.2.3
 * localhost-domains feature). Kept separate from the standalone runtime
 * script (see proxy-service.ts's PROXY_SCRIPT_SOURCE) so the host-routing
 * rules can be unit tested directly, without spinning up an HTTP server.
 *
 * Empirical notes (checked on this machine before building this, since the
 * behavior differs across Mac configurations):
 *   - Unprivileged port-80 binding on modern macOS is ADDRESS-SPECIFIC:
 *     binding 127.0.0.1:80 fails with EACCES, but binding the wildcard
 *     address 0.0.0.0:80 succeeds — macOS's unprivileged low-port allowance
 *     (since Mojave) applies to the wildcard address only. Both verified
 *     empirically on the dev machine. The proxy therefore binds 0.0.0.0:80
 *     and compensates for the wider exposure with a mandatory loopback-only
 *     guard (isLoopbackAddress below): every connection from a non-loopback
 *     peer is destroyed immediately, so nothing on the LAN ever gets a byte
 *     back. canBindPort80 (proxy-service.ts) probes the wildcard address to
 *     match, and install/update/repair still skip gracefully when port 80 is
 *     genuinely occupied.
 *   - `curl --resolve host:port:127.0.0.1` and a raw `Host:` header both
 *     route correctly through a Host-header-matching proxy on a real port —
 *     verified against a throwaway Node http server on port 8899.
 *   - Plain `curl http://test.localhost` DOES resolve to 127.0.0.1 on this
 *     Mac (macOS's mDNSResponder implements the RFC 6761 special-use
 *     `.localhost` resolution at the OS level, not just in browsers) — but
 *     that's incidental to this feature, which targets browsers per RFC 6761
 *     and doesn't depend on any particular CLI tool resolving it too.
 */

export interface ProxyInstallEntry {
  name: string;
  slug: string;
  webPort: number;
}

/**
 * SECURITY GUARD for the wildcard bind (see module docstring): true only for
 * loopback peer addresses. Accepts the whole 127.0.0.0/8 IPv4 loopback range
 * (as raw "127.x.x.x" or IPv4-mapped-IPv6 "::ffff:127.x.x.x", the form Node
 * reports for IPv4 peers on a dual-stack socket) and IPv6 "::1". Everything
 * else — including a missing/undefined remoteAddress (socket already gone) —
 * is rejected. Pure string logic so it's unit-testable; the standalone proxy
 * runtime embeds the identical rule.
 */
export function isLoopbackAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  if (remoteAddress === "::1") return true;
  const v4 = remoteAddress.startsWith("::ffff:") ? remoteAddress.slice(7) : remoteAddress;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4);
}

/**
 * Resolve a Host header (e.g. "work-brain.localhost", "work-brain.localhost:80")
 * to the target install's web port, by matching the slug. Returns null when
 * the host doesn't match any known install (caller renders the index page)
 * or the Host header is missing/malformed.
 */
export function resolveTarget(
  hostHeader: string | undefined,
  installs: ProxyInstallEntry[],
): ProxyInstallEntry | null {
  if (!hostHeader) return null;
  const hostname = hostHeader.split(":")[0].toLowerCase().trim();
  if (!hostname.endsWith(".localhost")) return null;
  const slug = hostname.slice(0, -".localhost".length);
  return installs.find((i) => i.slug === slug) ?? null;
}

/** The `<slug>.localhost` domain string for a given install. */
export function domainFor(slug: string): string {
  return `${slug}.localhost`;
}

/**
 * Build the tiny index page listing every install as a link to its
 * `<slug>.localhost` domain — shown when the Host header doesn't match any
 * known install (e.g. hitting the proxy directly by IP, or a typo'd domain).
 */
export function renderIndexPage(installs: ProxyInstallEntry[]): string {
  const rows = installs
    .map(
      (i) =>
        `<li><a href="http://${domainFor(i.slug)}">${escapeHtml(i.name)}</a> — ${domainFor(i.slug)}</li>`,
    )
    .join("\n");
  const body =
    installs.length > 0
      ? `<ul>\n${rows}\n</ul>`
      : "<p>No Arel OS installs found. Run <code>npx arelos</code> to install.</p>";
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Arel OS</title></head>
<body>
<h1>Arel OS installs on this Mac</h1>
${body}
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Map registry entries + their configs into the flat routing table the proxy
 * needs. Entries whose config is missing/unreadable are silently skipped —
 * a stale registry entry should never crash the shared proxy for every other
 * install.
 */
export function buildRoutingTable(
  entries: Array<{ name: string; slug: string; root: string }>,
  readConfig: (root: string) => { webPort: number } | null,
): ProxyInstallEntry[] {
  const table: ProxyInstallEntry[] = [];
  for (const entry of entries) {
    const config = readConfig(entry.root);
    if (!config) continue;
    table.push({ name: entry.name, slug: entry.slug, webPort: config.webPort });
  }
  return table;
}
