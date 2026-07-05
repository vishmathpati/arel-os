/**
 * Pure routing logic for the shared `com.arelos.proxy` service (0.2.3
 * localhost-domains feature). Kept separate from the standalone runtime
 * script (see proxy-service.ts's PROXY_SCRIPT_SOURCE) so the host-routing
 * rules can be unit tested directly, without spinning up an HTTP server.
 *
 * Empirical notes (checked on this machine before building this, since the
 * behavior differs across Mac configurations):
 *   - Binding port 80 as an unprivileged process is NOT guaranteed on modern
 *     macOS — it depends on local configuration. On the dev machine used to
 *     build this feature, an unprivileged bind to 127.0.0.1:80 failed with
 *     EACCES (no passwordless sudo available to grant it). The feature is
 *     therefore built to *attempt* the bind and gracefully skip when it
 *     can't, rather than assume success (see canBindPort80 in
 *     proxy-service.ts, and the fallback path in install.ts/update.ts).
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
