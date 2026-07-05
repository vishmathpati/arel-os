import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { PROXY_LABEL } from "../src/paths.js";
import { looksLikeValidPlist } from "../src/plist.js";
import { PROXY_SCRIPT_SOURCE, canBindPort80, renderProxyPlist } from "../src/proxy-service.js";

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

test("canBindPort80: resolves a boolean without throwing, and never leaves a listener behind", async () => {
  // We don't assert which way this goes — it's genuinely machine-dependent (see
  // proxy-service.ts docstring: this dev machine reports false, EACCES, without
  // elevated privileges). The contract under test is just "probes safely and
  // reports the real capability, without binding permanently or serving traffic".
  const result = await canBindPort80();
  assert.equal(typeof result, "boolean");

  // If it reported bindable, prove nothing is still holding the port afterward
  // by successfully binding again ourselves.
  if (result) {
    const again = await canBindPort80();
    assert.equal(again, true, "port 80 must be free again immediately after the probe closes it");
  }
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
  const PROXY_PORT = 58910;
  const BACKEND_PORT = 58911;

  mkdirSync(root, { recursive: true });
  writeFileSync(scriptPath, PROXY_SCRIPT_SOURCE);
  writeFileSync(
    registryPath,
    JSON.stringify([
      { name: "Test Brain", slug: "test-brain", root, createdAt: "2026-01-01T00:00:00.000Z" },
    ]),
  );
  writeFileSync(
    join(root, "config.json"),
    JSON.stringify({ version: 1, webPort: BACKEND_PORT, vaultPort: BACKEND_PORT + 1 }),
  );

  const backend = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`stub-backend-response:${req.url}:${req.headers.host}`);
  });
  await new Promise<void>((resolve) => backend.listen(BACKEND_PORT, "127.0.0.1", resolve));

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

    // Unknown host -> the fallback index page, not a proxied response.
    const indexRes = await fetch(`http://nope.localhost:${PROXY_PORT}/`);
    const indexBody = await indexRes.text();
    assert.match(indexBody, /Test Brain/);
    assert.match(indexBody, /test-brain\.localhost/);
  } finally {
    child.kill();
    await new Promise((resolve) => backend.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
