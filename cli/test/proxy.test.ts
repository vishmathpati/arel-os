import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type ProxyInstallEntry,
  buildRoutingTable,
  domainFor,
  isLoopbackAddress,
  renderIndexPage,
  resolveTarget,
} from "../src/proxy.js";

const installs: ProxyInstallEntry[] = [
  { name: "Work Brain", slug: "work-brain", webPort: 1400 },
  { name: "Arel OS", slug: "arelos", webPort: 1347 },
];

test("resolveTarget: matches a bare <slug>.localhost Host header", () => {
  const target = resolveTarget("work-brain.localhost", installs);
  assert.deepEqual(target, installs[0]);
});

test("resolveTarget: matches a Host header that includes a port suffix", () => {
  const target = resolveTarget("arelos.localhost:80", installs);
  assert.deepEqual(target, installs[1]);
});

test("resolveTarget: is case-insensitive", () => {
  const target = resolveTarget("Work-Brain.LOCALHOST", installs);
  assert.deepEqual(target, installs[0]);
});

test("resolveTarget: returns null for an unknown slug", () => {
  assert.equal(resolveTarget("nope.localhost", installs), null);
});

test("resolveTarget: returns null for a non-.localhost host", () => {
  assert.equal(resolveTarget("work-brain.example.com", installs), null);
});

test("resolveTarget: returns null when the Host header is missing", () => {
  assert.equal(resolveTarget(undefined, installs), null);
});

test("resolveTarget: returns null for a host that merely ends with the slug as a substring, not a full label match", () => {
  // "another-work-brain.localhost" must not match slug "work-brain".
  assert.equal(resolveTarget("another-work-brain.localhost", installs), null);
});

test("domainFor: formats the slug as a .localhost domain", () => {
  assert.equal(domainFor("work-brain"), "work-brain.localhost");
});

test("renderIndexPage: lists every install as a link to its domain", () => {
  const html = renderIndexPage(installs);
  assert.match(html, /work-brain\.localhost/);
  assert.match(html, /arelos\.localhost/);
  assert.match(html, /Work Brain/);
});

test("renderIndexPage: escapes HTML in install names", () => {
  const html = renderIndexPage([{ name: "<script>alert(1)</script>", slug: "evil", webPort: 1 }]);
  assert.ok(!html.includes("<script>alert"));
  assert.match(html, /&lt;script&gt;/);
});

test("renderIndexPage: shows a helpful message when there are no installs", () => {
  const html = renderIndexPage([]);
  assert.match(html, /No Arel OS installs found/);
});

test("buildRoutingTable: maps registry entries through readConfig, keyed by webPort", () => {
  const entries = [
    { name: "Work Brain", slug: "work-brain", root: "/tmp/work-brain" },
    { name: "Home", slug: "home", root: "/tmp/home" },
  ];
  const configs: Record<string, { webPort: number }> = {
    "/tmp/work-brain": { webPort: 1400 },
    "/tmp/home": { webPort: 1500 },
  };
  const table = buildRoutingTable(entries, (root) => configs[root] ?? null);
  assert.deepEqual(table, [
    { name: "Work Brain", slug: "work-brain", webPort: 1400 },
    { name: "Home", slug: "home", webPort: 1500 },
  ]);
});

test("buildRoutingTable: silently skips entries whose config is missing (stale registry entry)", () => {
  const entries = [
    { name: "Work Brain", slug: "work-brain", root: "/tmp/work-brain" },
    { name: "Gone", slug: "gone", root: "/tmp/gone" },
  ];
  const table = buildRoutingTable(entries, (root) =>
    root === "/tmp/work-brain" ? { webPort: 1400 } : null,
  );
  assert.deepEqual(table, [{ name: "Work Brain", slug: "work-brain", webPort: 1400 }]);
});

// ── isLoopbackAddress: the security guard behind the wildcard 0.0.0.0:80 bind ──
// (macOS only allows unprivileged port-80 binds on the wildcard address, so
// the proxy is LAN-reachable at the socket level — this predicate is the only
// thing standing between the LAN and the routing logic. Exhaustive on purpose.)

test("isLoopbackAddress: accepts IPv4 loopback 127.0.0.1", () => {
  assert.equal(isLoopbackAddress("127.0.0.1"), true);
});

test("isLoopbackAddress: accepts the whole 127.0.0.0/8 range", () => {
  assert.equal(isLoopbackAddress("127.0.0.2"), true);
  assert.equal(isLoopbackAddress("127.255.255.254"), true);
});

test("isLoopbackAddress: accepts IPv6 loopback ::1", () => {
  assert.equal(isLoopbackAddress("::1"), true);
});

test("isLoopbackAddress: accepts IPv4-mapped IPv6 loopback ::ffff:127.0.0.1 (Node's form for IPv4 peers on dual-stack sockets)", () => {
  assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
  assert.equal(isLoopbackAddress("::ffff:127.0.0.53"), true);
});

test("isLoopbackAddress: rejects LAN and public IPv4 addresses", () => {
  assert.equal(isLoopbackAddress("192.168.1.42"), false);
  assert.equal(isLoopbackAddress("10.0.0.5"), false);
  assert.equal(isLoopbackAddress("172.16.0.1"), false);
  assert.equal(isLoopbackAddress("8.8.8.8"), false);
});

test("isLoopbackAddress: rejects IPv4-mapped non-loopback addresses", () => {
  assert.equal(isLoopbackAddress("::ffff:192.168.1.42"), false);
  assert.equal(isLoopbackAddress("::ffff:8.8.8.8"), false);
});

test("isLoopbackAddress: rejects non-loopback IPv6 addresses", () => {
  assert.equal(isLoopbackAddress("fe80::1"), false);
  assert.equal(isLoopbackAddress("2001:db8::1"), false);
  assert.equal(isLoopbackAddress("::2"), false);
});

test("isLoopbackAddress: rejects a missing remoteAddress (socket already torn down)", () => {
  assert.equal(isLoopbackAddress(undefined), false);
  assert.equal(isLoopbackAddress(""), false);
});

test("isLoopbackAddress: rejects lookalike strings that merely contain 127", () => {
  assert.equal(isLoopbackAddress("1127.0.0.1"), false);
  assert.equal(isLoopbackAddress("127.0.0"), false);
  assert.equal(isLoopbackAddress("localhost"), false);
});
