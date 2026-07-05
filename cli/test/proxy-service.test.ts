import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PROXY_LABEL } from "../src/paths.js";
import { looksLikeValidPlist } from "../src/plist.js";
import { PROXY_SCRIPT_SOURCE, canBindPort80, renderProxyPlist } from "../src/proxy-service.js";
import { isLoopbackAddress } from "../src/proxy.js";

// import.meta.dirname is dist-test/test/ once compiled; walk up to the repo root.
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

test("renderProxyPlist: renders the real shipped proxy.plist.tmpl into a valid, fully-substituted plist", () => {
  const xml = renderProxyPlist(REPO_ROOT, "/opt/homebrew/bin/node");
  assert.equal(looksLikeValidPlist(xml), true);
  assert.match(xml, new RegExp(`<string>${PROXY_LABEL}</string>`));
  assert.match(xml, /<string>\/opt\/homebrew\/bin\/node<\/string>/);
  assert.match(xml, /proxy\.mjs<\/string>/);
  assert.match(xml, /installs\.json<\/string>/);
  assert.match(xml, /<key>RunAtLoad<\/key><true\/>/);
  assert.match(xml, /<key>KeepAlive<\/key><true\/>/);
});

test("canBindPort80: agrees with a direct wildcard bind attempt, and never leaves a listener behind", async () => {
  // The probe MUST target the wildcard address (0.0.0.0): macOS's unprivileged
  // low-port allowance applies only to it — a loopback-specific probe reports
  // "can't bind" (EACCES) on a stock Mac even though the wildcard bind works,
  // which would silently disable the domains feature everywhere. Rather than
  // hard-coding the expected boolean (something else could legitimately hold
  // port 80 on a given machine), assert the probe agrees with an independent
  // direct 0.0.0.0:80 bind attempt performed right here.
  const direct = await new Promise<boolean>((resolve) => {
    const server = createNetServer();
    server.once("error", () => {
      server.close();
      resolve(false);
    });
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(80, "0.0.0.0");
  });

  const result = await canBindPort80();
  assert.equal(result, direct, "probe must report the same capability as a direct wildcard bind");

  // If it reported bindable, prove nothing is still holding the port afterward
  // by successfully binding again ourselves.
  if (result) {
    const again = await canBindPort80();
    assert.equal(again, true, "port 80 must be free again immediately after the probe closes it");
  }
});

test("PROXY_SCRIPT_SOURCE: binds the wildcard address and carries the loopback-only guard at connection, request, and upgrade layers", () => {
  // Wildcard bind (the reason the guard exists — see proxy.ts docstring).
  assert.match(PROXY_SCRIPT_SOURCE, /server\.listen\(PORT, "0\.0\.0\.0"/);
  assert.ok(
    !PROXY_SCRIPT_SOURCE.includes('server.listen(PORT, "127.0.0.1"'),
    "must not bind loopback-only — that fails EACCES unprivileged on macOS",
  );
  // Connection-level guard (primary: destroys before HTTP parsing).
  assert.match(
    PROXY_SCRIPT_SOURCE,
    /server\.on\("connection", \(socket\) => \{\s*\n?\s*if \(!isLoopbackAddress\(socket\.remoteAddress\)\) socket\.destroy\(\);/,
  );
  // Request-level guard (defense in depth).
  assert.match(PROXY_SCRIPT_SOURCE, /if \(!isLoopbackAddress\(req\.socket\.remoteAddress\)\)/);
  // Upgrade-path guard.
  assert.match(PROXY_SCRIPT_SOURCE, /if \(!isLoopbackAddress\(clientSocket\.remoteAddress\)\)/);
});

test("PROXY_SCRIPT_SOURCE: dials both loopback families — 127.0.0.1 first, ::1 fallback on refused/unreachable (vite-preview [::1]-only field bug)", () => {
  assert.match(PROXY_SCRIPT_SOURCE, /const TARGET_HOSTS = \["127\.0\.0\.1", "::1"\];/);
  assert.match(PROXY_SCRIPT_SOURCE, /ECONNREFUSED|EHOSTUNREACH/);
  // Both the HTTP path and the websocket upgrade path must go through the
  // fallback-capable connector, never a hardcoded single-family dial.
  const connectorUses = PROXY_SCRIPT_SOURCE.match(/connectToTarget\(target\.webPort/g) ?? [];
  assert.equal(connectorUses.length, 2, "HTTP and upgrade paths must both use connectToTarget");
  assert.ok(
    !PROXY_SCRIPT_SOURCE.includes('net.connect(target.webPort, "127.0.0.1"'),
    "no single-family direct dial to the target may remain",
  );
});

test("connection guard (mocked socket): destroys a non-loopback peer and leaves a loopback peer alone", () => {
  // The exact wiring the runtime installs on "connection" (asserted to exist
  // in the script source above), exercised against mocked socket objects so
  // the reject path is proven without needing a real LAN peer.
  const guard = (socket: { remoteAddress?: string; destroy: () => void }) => {
    if (!isLoopbackAddress(socket.remoteAddress)) socket.destroy();
  };

  const mockSocket = (remoteAddress: string | undefined) => {
    const socket = {
      remoteAddress,
      destroyed: false,
      destroy() {
        socket.destroyed = true;
      },
    };
    return socket;
  };

  const lan = mockSocket("192.168.1.42");
  guard(lan);
  assert.equal(lan.destroyed, true, "a LAN peer must be destroyed on arrival");

  const mappedLan = mockSocket("::ffff:10.0.0.7");
  guard(mappedLan);
  assert.equal(mappedLan.destroyed, true, "an IPv4-mapped LAN peer must be destroyed too");

  const missing = mockSocket(undefined);
  guard(missing);
  assert.equal(missing.destroyed, true, "a socket with no peer address must be rejected");

  const loopback = mockSocket("127.0.0.1");
  guard(loopback);
  assert.equal(loopback.destroyed, false, "loopback peers must pass through untouched");

  const v6Loopback = mockSocket("::1");
  guard(v6Loopback);
  assert.equal(v6Loopback.destroyed, false, "IPv6 loopback peers must pass through untouched");
});

test("PROXY_SCRIPT_SOURCE: is syntactically valid ESM (uses import, not require, since it's written with a .mjs extension)", () => {
  assert.ok(
    !PROXY_SCRIPT_SOURCE.includes("require("),
    "must not use CommonJS require — the file is written as .mjs",
  );
  assert.match(PROXY_SCRIPT_SOURCE, /^import http from "node:http";/m);
});

test("renderProxyPlist: substitutes every template token and leaves no placeholder behind", () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-proxy-plist-test-"));
  try {
    mkdirSync(join(dir, "scripts", "service"), { recursive: true });
    writeFileSync(
      join(dir, "scripts", "service", "proxy.plist.tmpl"),
      [
        "<label>{{LABEL}}</label>",
        "<node>{{NODE_BIN}}</node>",
        "<script>{{PROXY_SCRIPT}}</script>",
        "<registry>{{REGISTRY_PATH}}</registry>",
        "<log>{{LOG_PATH}}</log>",
      ].join("\n"),
    );
    const xml = renderProxyPlist(dir, "/usr/local/bin/node");
    assert.ok(!xml.includes("{{"), "no unresolved template tokens should remain");
    assert.match(xml, new RegExp(PROXY_LABEL));
    assert.match(xml, /\/usr\/local\/bin\/node/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("renderProxyPlist: throws a clear error when the template file is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-proxy-plist-missing-test-"));
  try {
    assert.throws(() => renderProxyPlist(dir), /Missing plist template/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * The real ephemeral test the spec calls for: run the actual proxy runtime
 * script (PROXY_SCRIPT_SOURCE, the exact bytes written to ~/.arelos/proxy.mjs
 * in production) as a real child `node` process on a high port, with a
 * throwaway registry + config pointing at a stub backend server. Curls it
 * with a Host header and asserts the response is proxied through from the
 * stub — proving the routing logic works end-to-end as a standalone script,
 * not just as unit-tested pure functions. Never touches port 80.
 */
test("proxy runtime script (real process, high port): routes a Host-header request through to the matching install's backend", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-proxy-e2e-test-"));
  const scriptPath = join(dir, "proxy.mjs");
  const registryPath = join(dir, "installs.json");
  const root = join(dir, "brain");
  const v6Root = join(dir, "v6-brain");
  const PROXY_PORT = 58910;
  const BACKEND_PORT = 58911;
  const V6_BACKEND_PORT = 58912;

  mkdirSync(root, { recursive: true });
  mkdirSync(v6Root, { recursive: true });
  writeFileSync(scriptPath, PROXY_SCRIPT_SOURCE);
  writeFileSync(
    registryPath,
    JSON.stringify([
      { name: "Test Brain", slug: "test-brain", root, createdAt: "2026-01-01T00:00:00.000Z" },
      { name: "V6 Brain", slug: "v6-brain", root: v6Root, createdAt: "2026-01-01T00:00:00.000Z" },
    ]),
  );
  writeFileSync(
    join(root, "config.json"),
    JSON.stringify({ version: 1, webPort: BACKEND_PORT, vaultPort: BACKEND_PORT + 1 }),
  );
  writeFileSync(
    join(v6Root, "config.json"),
    JSON.stringify({ version: 1, webPort: V6_BACKEND_PORT, vaultPort: V6_BACKEND_PORT + 10 }),
  );

  const backend = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`stub-backend-response:${req.url}:${req.headers.host}`);
  });
  await new Promise<void>((resolve) => backend.listen(BACKEND_PORT, "127.0.0.1", resolve));

  // Second stub bound to ::1 ONLY — the exact field shape that broke:
  // vite preview was found listening on [::1]:<port> with no IPv4 socket,
  // so a proxy that only ever dials 127.0.0.1 gets ECONNREFUSED.
  const v6Backend = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`v6-only-backend-response:${req.url}`);
  });
  await new Promise<void>((resolve) => v6Backend.listen(V6_BACKEND_PORT, "::1", resolve));

  const child = spawn(process.execPath, [scriptPath], {
    env: {
      ...process.env,
      ARELOS_REGISTRY_PATH: registryPath,
      ARELOS_PROXY_PORT: String(PROXY_PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    // Wait for the proxy to announce it's listening (bounded — fails the test via timeout otherwise).
    await new Promise<void>((resolve, reject) => {
      let out = "";
      const onData = (d: Buffer) => {
        out += d.toString();
        if (out.includes("listening on")) {
          child.stdout?.off("data", onData);
          resolve();
        }
      };
      child.stdout?.on("data", onData);
      child.on("error", reject);
      setTimeout(
        () => reject(new Error(`proxy did not start in time; stdout so far: ${out}`)),
        5000,
      );
    });

    // Request the real <slug>.localhost:port URL directly (exactly what a browser
    // does per RFC 6761) rather than spoofing a Host header on a 127.0.0.1 request
    // — Node's fetch/undici ignores a manually-set Host header on the latter, but
    // *.localhost genuinely resolves to 127.0.0.1 (verified empirically on this
    // Mac — see proxy.ts docstring), so this exercises the real routing path.
    const res = await fetch(`http://test-brain.localhost:${PROXY_PORT}/hello`);
    const body = await res.text();
    assert.equal(res.status, 200);
    assert.equal(body, `stub-backend-response:/hello:test-brain.localhost:${PROXY_PORT}`);

    // Dual-family fallback (field-bug regression): the v6-brain backend
    // listens on ::1 ONLY. The proxy must fail its 127.0.0.1 attempt with
    // ECONNREFUSED, retry ::1, and still deliver the proxied response —
    // not the bad-gateway page.
    const v6Res = await fetch(`http://v6-brain.localhost:${PROXY_PORT}/v6check`);
    const v6Body = await v6Res.text();
    assert.equal(v6Res.status, 200);
    assert.equal(v6Body, "v6-only-backend-response:/v6check");

    // Unknown host -> the fallback index page, not a proxied response.
    const indexRes = await fetch(`http://nope.localhost:${PROXY_PORT}/`);
    const indexBody = await indexRes.text();
    assert.match(indexBody, /Test Brain/);
    assert.match(indexBody, /test-brain\.localhost/);

    // SECURITY GUARD end-to-end: connect via the machine's own LAN address —
    // the proxy then sees a genuine non-loopback remoteAddress (verified
    // empirically: peer shows as the LAN IP, e.g. 192.168.x.x, not 127.0.0.1)
    // and must destroy the connection before responding. Skipped only when
    // the machine has no external IPv4 interface (e.g. no network).
    const lanAddress = Object.values(networkInterfaces())
      .flatMap((addrs) => addrs ?? [])
      .find((a) => a.family === "IPv4" && !a.internal)?.address;
    if (lanAddress) {
      await assert.rejects(
        fetch(`http://${lanAddress}:${PROXY_PORT}/`, { signal: AbortSignal.timeout(3000) }),
        `a request arriving from non-loopback peer ${lanAddress} must be destroyed, not answered`,
      );
    }
  } finally {
    // Wait for the child to actually exit, not just receive the signal —
    // otherwise a back-to-back test run can spawn its proxy while this one
    // still holds the fixed port, EADDRINUSE, and flake on startup timeout.
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await exited;
    await new Promise((resolve) => backend.close(resolve));
    await new Promise((resolve) => v6Backend.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
