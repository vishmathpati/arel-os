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

test("isPortFree reports false while a server is listening on the port", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(58232, "127.0.0.1", resolve));
  try {
    const free = await isPortFree(58232);
    assert.equal(free, false);
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
