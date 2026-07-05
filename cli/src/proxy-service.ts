/**
 * The shared `com.arelos.proxy` service (0.2.3 localhost-domains feature).
 * One proxy, shared across every install on the Mac, gives each install
 * `http://<slug>.localhost` instead of a port to remember. See proxy.ts for
 * the pure host-routing logic this service's runtime script embeds.
 *
 * Design (see proxy.ts docstring for the empirical findings behind this):
 *   - The proxy binds 127.0.0.1:80 only when that's actually possible on this
 *     Mac (checked fresh via canBindPort80 — never assumed). If port 80 is
 *     occupied by something else, install/update/repair skip the proxy
 *     silently (one info line) and ports remain the way in — nothing about
 *     the rest of the install is gated on this.
 *   - The runtime script is NOT part of any single install's checkout. It's
 *     written to ~/.arelos/proxy.mjs (alongside the registry) and
 *     (re)written by the CLI on every install/update/repair, so it always
 *     reflects the current CLI version's routing logic and never depends on
 *     a specific install surviving an uninstall. This is the simplest robust
 *     answer to "which install owns the shared proxy": none of them do —
 *     the CLI does.
 *   - Re-reads the registry + each install's config.json on every incoming
 *     request (no cache) — registries change rarely, and installs are small
 *     in number, so correctness-over-cleverness wins here.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import {
  type BootstrapSequenceEffects,
  bootoutService,
  bootstrapServiceSequenced,
} from "./launchd.js";
import {
  PROXY_LABEL,
  configDir,
  launchAgentsDir,
  plistPath,
  proxyScriptPath,
  registryPath,
} from "./paths.js";

/**
 * Probe whether an unprivileged process can bind 127.0.0.1:80 on this
 * machine right now. Binds and immediately closes — never serves. This is
 * checked fresh on every install/update/repair rather than assumed, since
 * whether unprivileged port 80 binds is a per-machine/per-OS-version fact,
 * not a constant (verified empirically while building this feature: it
 * fails with EACCES on the dev machine without elevated privileges).
 */
export function canBindPort80(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => {
      server.close();
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    try {
      server.listen(80, "127.0.0.1");
    } catch {
      resolve(false);
    }
  });
}

/**
 * The proxy's standalone runtime — Node stdlib only, no dependency on the
 * CLI package at runtime (it's invoked directly by launchd via `node
 * <this file>`, not through `arelos`'s own module graph). Mirrors the
 * host-routing rules unit-tested in proxy.ts; kept as a template string
 * (rather than importing proxy.ts's compiled output) so this file is fully
 * self-contained on disk and never breaks if the CLI's own dist/ layout
 * changes.
 */
export const PROXY_SCRIPT_SOURCE = `#!/usr/bin/env node
// Arel OS shared localhost-domain proxy — written by the arelos CLI.
// Do not edit by hand; it is overwritten on every install/update/repair.
// Written with a .mjs extension (see proxyScriptPath), so this must be ESM.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function registryPath() {
  return process.env.ARELOS_REGISTRY_PATH || path.join(os.homedir(), ".arelos", "installs.json");
}

function readRegistry() {
  try {
    const raw = JSON.parse(fs.readFileSync(registryPath(), "utf8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function readConfig(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
  } catch {
    return null;
  }
}

function buildRoutingTable() {
  const table = [];
  for (const entry of readRegistry()) {
    const config = readConfig(entry.root);
    if (!config || typeof config.webPort !== "number") continue;
    table.push({ name: entry.name, slug: entry.slug, webPort: config.webPort });
  }
  return table;
}

function resolveTarget(hostHeader, installs) {
  if (!hostHeader) return null;
  const hostname = hostHeader.split(":")[0].toLowerCase().trim();
  if (!hostname.endsWith(".localhost")) return null;
  const slug = hostname.slice(0, -".localhost".length);
  return installs.find((i) => i.slug === slug) || null;
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderIndexPage(installs) {
  const rows = installs
    .map((i) => \`<li><a href="http://\${i.slug}.localhost">\${escapeHtml(i.name)}</a> — \${i.slug}.localhost</li>\`)
    .join("\\n");
  const body = installs.length > 0 ? \`<ul>\\n\${rows}\\n</ul>\` : "<p>No Arel OS installs found. Run <code>npx arelos</code> to install.</p>";
  return \`<!doctype html>
<html>
<head><meta charset="utf-8"><title>Arel OS</title></head>
<body>
<h1>Arel OS installs on this Mac</h1>
\${body}
</body>
</html>
\`;
}

const PORT = Number(process.env.ARELOS_PROXY_PORT || 80);

const server = http.createServer((req, res) => {
  const installs = buildRoutingTable();
  const target = resolveTarget(req.headers.host, installs);
  if (!target) {
    const body = renderIndexPage(installs);
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": Buffer.byteLength(body) });
    res.end(body);
    return;
  }

  const proxyReq = http.request(
    {
      hostname: "127.0.0.1",
      port: target.webPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad gateway: " + target.name + " is not responding on port " + target.webPort);
  });
  req.pipe(proxyReq);
});

// Best-effort WebSocket proxying (upgrade requests) — a plain TCP pipe to the
// same target, so any future dev-server HMR socket or similar still works.
// The current web service (vite preview, per scripts/service/run-web.sh)
// doesn't require this, but it's trivial to add and future-proofs the proxy.
server.on("upgrade", (req, clientSocket, head) => {
  const installs = buildRoutingTable();
  const target = resolveTarget(req.headers.host, installs);
  if (!target) {
    clientSocket.destroy();
    return;
  }
  const upstream = net.connect(target.webPort, "127.0.0.1", () => {
    upstream.write(
      \`\${req.method} \${req.url} HTTP/1.1\\r\\n\` +
        Object.entries(req.headers)
          .map(([k, v]) => \`\${k}: \${v}\`)
          .join("\\r\\n") +
        "\\r\\n\\r\\n",
    );
    if (head && head.length) upstream.write(head);
    upstream.pipe(clientSocket);
    clientSocket.pipe(upstream);
  });
  upstream.on("error", () => clientSocket.destroy());
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(\`[\${new Date().toISOString()}] Arel OS proxy listening on http://127.0.0.1:\${PORT}\`);
});
`;

/** Write (or refresh) the standalone proxy runtime script at ~/.arelos/proxy.mjs. */
export function writeProxyScript(): string {
  const p = proxyScriptPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, PROXY_SCRIPT_SOURCE);
  chmodSync(p, 0o755);
  return p;
}

export function proxyLogPath(): string {
  return join(configDir(), "logs", "proxy.log");
}

/** Render the proxy's plist from the template shipped in the app repo's scripts/service/. */
export function renderProxyPlist(
  templateInstallDir: string,
  nodeBin: string = process.execPath,
): string {
  const templatePath = join(templateInstallDir, "scripts", "service", "proxy.plist.tmpl");
  if (!existsSync(templatePath)) {
    throw new Error(`Missing plist template: ${templatePath}`);
  }
  const template = readFileSync(templatePath, "utf8");
  return template
    .split("{{LABEL}}")
    .join(PROXY_LABEL)
    .split("{{NODE_BIN}}")
    .join(nodeBin)
    .split("{{PROXY_SCRIPT}}")
    .join(proxyScriptPath())
    .split("{{REGISTRY_PATH}}")
    .join(registryPath())
    .split("{{LOG_PATH}}")
    .join(proxyLogPath());
}

/**
 * Install (or refresh) the shared proxy: write the runtime script, render +
 * write the plist, ensure its log dir exists, then bootstrap it via the same
 * race-safe sequence used for the per-install web/vault services. Returns
 * whether it's now running.
 */
export async function installProxyService(
  templateInstallDir: string,
  effects?: BootstrapSequenceEffects,
): Promise<{ ok: boolean; error?: string }> {
  writeProxyScript();
  mkdirSync(dirname(proxyLogPath()), { recursive: true });
  mkdirSync(launchAgentsDir(), { recursive: true });
  const xml = renderProxyPlist(templateInstallDir);
  writeFileSync(plistPath(PROXY_LABEL), xml);

  const res = await bootstrapServiceSequenced(PROXY_LABEL, effects);
  return res.ok ? { ok: true } : { ok: false, error: res.stderr };
}

/** Stop and unregister the shared proxy (called when the last install is uninstalled). */
export async function removeProxyService(effects?: BootstrapSequenceEffects): Promise<void> {
  await bootoutService(PROXY_LABEL, effects);
  const p = plistPath(PROXY_LABEL);
  if (existsSync(p)) unlinkSync(p);
}

/** True if the proxy's plist is currently registered (used by list/status/uninstall-of-last logic). */
export function isProxyRegistered(): boolean {
  return existsSync(plistPath(PROXY_LABEL));
}
