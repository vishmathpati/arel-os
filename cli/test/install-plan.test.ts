import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import {
  appDirFor,
  checkRootDir,
  defaultParentDir,
  normalizeDisplayName,
  resolvePort,
  rootFor,
  slugifyName,
  slugOrFallback,
  TCC_PROTECTED_PATH_MESSAGE,
  toArelConfig,
  vaultPathFor,
} from "../src/install-plan.js";
import { deriveServiceLabels } from "../src/paths.js";
import { createServer } from "node:net";

test("normalizeDisplayName trims and falls back to default on empty input", () => {
  assert.equal(normalizeDisplayName("  My Brain  "), "My Brain");
  assert.equal(normalizeDisplayName(""), "Arel OS");
  assert.equal(normalizeDisplayName("   "), "Arel OS");
});

test("appDirFor / vaultPathFor derive fixed children of root", () => {
  assert.equal(appDirFor("/tmp/x"), join("/tmp/x", "app"));
  assert.equal(vaultPathFor("/tmp/x"), join("/tmp/x", "vault"));
});

test("slugifyName lowercases, dashes spaces, and strips unsafe chars", () => {
  assert.equal(slugifyName("My Brain"), "my-brain");
  assert.equal(slugifyName("  Vish's OS!! "), "vish-s-os");
  assert.equal(slugifyName("Arel_OS 2.0"), "arel-os-2-0");
  assert.equal(slugifyName("💫💫"), "");
});

test("slugOrFallback falls back to the fixed default when the name slugifies to empty", () => {
  assert.equal(slugOrFallback("💫💫"), "arelos");
  assert.equal(slugOrFallback("   "), "arelos");
  assert.equal(slugOrFallback("My Brain"), "my-brain");
});

test("defaultParentDir is the home directory", () => {
  assert.equal(defaultParentDir(), "~");
});

test("rootFor always appends the slug, even for a custom parent", () => {
  assert.equal(rootFor("~", "My Brain"), join(homedir(), "my-brain"));
  assert.equal(rootFor("/tmp", "My Brain"), join("/tmp", "my-brain"));
});

test("checkRootDir flags a non-empty dir that isn't a prior arelos install", () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-root-test-"));
  try {
    writeFileSync(join(dir, "random-file.txt"), "hi");
    const check = checkRootDir(dir);
    assert.equal(check.exists, true);
    assert.equal(check.nonEmpty, true);
    assert.equal(check.isPriorArelosInstall, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkRootDir recognizes a prior arelos install (root/app is a git checkout)", () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-root-test-"));
  try {
    mkdirSync(join(dir, "app", ".git"), { recursive: true });
    writeFileSync(join(dir, "app", "package.json"), "{}");
    const check = checkRootDir(dir);
    assert.equal(check.isPriorArelosInstall, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkRootDir reports empty for a fresh nonexistent path", () => {
  const check = checkRootDir(join(tmpdir(), "arelos-does-not-exist-xyz"));
  assert.equal(check.exists, false);
  assert.equal(check.nonEmpty, false);
});

test("checkRootDir flags isTccProtected for a path inside ~/Desktop", () => {
  const check = checkRootDir(join(homedir(), "Desktop", "arelos-tcc-test"));
  assert.equal(check.isTccProtected, true);
});

test("checkRootDir does not flag isTccProtected for a normal home-relative path", () => {
  const check = checkRootDir(join(homedir(), "arelos-tcc-test-safe"));
  assert.equal(check.isTccProtected, false);
});

test("TCC_PROTECTED_PATH_MESSAGE names the actual restriction in plain English", () => {
  assert.match(TCC_PROTECTED_PATH_MESSAGE, /Desktop/);
  assert.match(TCC_PROTECTED_PATH_MESSAGE, /Documents/);
  assert.match(TCC_PROTECTED_PATH_MESSAGE, /Downloads/);
  assert.match(TCC_PROTECTED_PATH_MESSAGE, /iCloud Drive/);
});

test("resolvePort returns the requested port when free", async () => {
  const res = await resolvePort(58260);
  assert.equal(res.wasFree, true);
  assert.equal(res.resolved, 58260);
});

test("resolvePort suggests the next free port when the requested one is taken", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(58261, "127.0.0.1", resolve));
  try {
    const res = await resolvePort(58261);
    assert.equal(res.wasFree, false);
    assert.ok(res.resolved > 58261);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("resolvePort rejects an invalid port", async () => {
  await assert.rejects(() => resolvePort(80), /invalid/);
});

test("resolvePort proposes a free port when the requested one has an IPv4-only listener (field-test fix: pre-filled prompt default must never be an occupied port)", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(58262, "127.0.0.1", resolve));
  try {
    const res = await resolvePort(58262);
    assert.equal(res.wasFree, false);
    assert.ok(res.resolved > 58262, "the computed default must not be the occupied port");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("resolvePort proposes a free port when the requested one has an IPv6-only listener (field-test fix: a [::1]-only server occupied the default while the IPv4 probe called it free)", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(58263, "::1", resolve));
  try {
    const res = await resolvePort(58263);
    assert.equal(res.wasFree, false, "an IPv6-only listener must mark the requested port as taken");
    assert.ok(res.resolved > 58263, "the computed default must skip past the [::1]-occupied port");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("toArelConfig expands ~ in root/installDir/vaultPath and stamps version 1", () => {
  const config = toArelConfig({
    displayName: "Test Brain",
    root: "~/arelos-test-root",
    installDir: "~/arelos-test-root/app",
    vaultPath: "~/arelos-test-root/vault",
    webPort: 1400,
    vaultPort: 5300,
  });
  assert.equal(config.version, 1);
  assert.equal(config.root, join(homedir(), "arelos-test-root"));
  assert.equal(config.installDir, join(homedir(), "arelos-test-root", "app"));
  assert.equal(config.vaultPath, join(homedir(), "arelos-test-root", "vault"));
  assert.equal(config.webPort, 1400);
  assert.equal(config.vaultPort, 5300);
  assert.deepEqual(config.serviceLabels, deriveServiceLabels(join(homedir(), "arelos-test-root")));
});
