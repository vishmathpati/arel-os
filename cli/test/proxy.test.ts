import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type ProxyInstallEntry,
  buildRoutingTable,
  domainFor,
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
