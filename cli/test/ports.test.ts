import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { findFreePort, isPortFree, isValidPort } from "../src/ports.js";

test("isValidPort rejects non-integers, low ports, and out-of-range ports", () => {
  assert.equal(isValidPort(1347), true);
  assert.equal(isValidPort(1023), false);
  assert.equal(isValidPort(1024), true);
  assert.equal(isValidPort(65535), true);
  assert.equal(isValidPort(65536), false);
  assert.equal(isValidPort(1347.5), false);
  assert.equal(isValidPort(-1), false);
});

test("isPortFree reports true for an unbound high port", async () => {
  // Pick a port unlikely to be in use; the test suite doesn't bind anything
  // globally so this should be reliably free.
  const free = await isPortFree(58231);
  assert.equal(free, true);
});

test("isPortFree reports false while an IPv4-only server is listening on the port", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(58232, "127.0.0.1", resolve));
  try {
    const free = await isPortFree(58232);
    assert.equal(free, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("isPortFree reports false while an IPv6-only server is listening on the port (field-test fix: [::1]-only listener left 127.0.0.1 bindable)", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(58233, "::1", resolve));
  try {
    const free = await isPortFree(58233);
    assert.equal(free, false, "a [::1]-only listener must make the port count as occupied");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("isPortFree reports false while a WILDCARD server is listening on the port (field bug 4: net.createServer().listen(port) with no host, exactly the failing shape — a live Bun server on *:5274 was reported free)", async () => {
  const server = createServer();
  // No host argument at all — this is the real wildcard-bind shape used by
  // Bun.serve() and by net servers that omit a hostname.
  await new Promise<void>((resolve) => server.listen(58234, resolve));
  try {
    const free = await isPortFree(58234);
    assert.equal(free, false, "a wildcard listener must make the port count as occupied");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("findFreePort scans upward past a WILDCARD-bound taken port", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(58235, resolve));
  try {
    const found = await findFreePort(58235);
    assert.ok(found > 58235, `expected a port above 58235, got ${found}`);
    assert.equal(await isPortFree(found), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("findFreePort scans upward past an IPv6-only taken port", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(58236, "::1", resolve));
  try {
    const found = await findFreePort(58236);
    assert.ok(found > 58236, `expected a port above 58236, got ${found}`);
    assert.equal(await isPortFree(found), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("findFreePort scans upward past a taken port and returns a free one", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(58240, "127.0.0.1", resolve));
  try {
    const found = await findFreePort(58240);
    assert.ok(found > 58240, `expected a port above 58240, got ${found}`);
    assert.equal(await isPortFree(found), true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("findFreePort returns the start port immediately if already free", async () => {
  const found = await findFreePort(58250);
  assert.equal(found, 58250);
});
