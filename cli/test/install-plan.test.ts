import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import {
  checkInstallDir,
  defaultVaultPath,
  normalizeDisplayName,
  resolvePort,
  toArelConfig,
} from "../src/install-plan.js";
import { createServer } from "node:net";

test("normalizeDisplayName trims and falls back to default on empty input", () => {
  assert.equal(normalizeDisplayName("  My Brain  "), "My Brain");
  assert.equal(normalizeDisplayName(""), "Arel OS");
  assert.equal(normalizeDisplayName("   "), "Arel OS");
});

test("defaultVaultPath appends /vault and expands ~", () => {
  assert.equal(defaultVaultPath("~/ArelOS"), join(homedir(), "ArelOS", "vault"));
  assert.equal(defaultVaultPath("/tmp/x"), "/tmp/x/vault");
});

test("checkInstallDir flags a non-empty dir that isn't a prior arelos checkout", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlo-installdir-test-"));
  try {
    writeFileSync(join(dir, "random-file.txt"), "hi");
    const check = checkInstallDir(dir);
    assert.equal(check.exists, true);
    assert.equal(check.nonEmpty, true);
    assert.equal(check.isPriorArelosInstall, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkInstallDir recognizes a prior arelos checkout (.git + package.json)", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlo-installdir-test-"));
  try {
    mkdirSync(join(dir, ".git"));
    writeFileSync(join(dir, "package.json"), "{}");
    const check = checkInstallDir(dir);
    assert.equal(check.isPriorArelosInstall, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checkInstallDir reports empty for a fresh nonexistent path", () => {
  const check = checkInstallDir(join(tmpdir(), "rlo-does-not-exist-xyz"));
  assert.equal(check.exists, false);
  assert.equal(check.nonEmpty, false);
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

test("toArelConfig expands ~ in installDir/vaultPath and stamps version 1", () => {
  const config = toArelConfig({
    displayName: "Test Brain",
    installDir: "~/arelos-test-install",
    vaultPath: "~/arelos-test-vault",
    webPort: 1400,
    vaultPort: 5300,
  });
  assert.equal(config.version, 1);
  assert.equal(config.installDir, join(homedir(), "arelos-test-install"));
  assert.equal(config.vaultPath, join(homedir(), "arelos-test-vault"));
  assert.equal(config.webPort, 1400);
  assert.equal(config.vaultPort, 5300);
});
