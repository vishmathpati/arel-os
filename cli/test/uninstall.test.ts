import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performUninstall, shouldDeleteVault } from "../src/uninstall.js";

test("shouldDeleteVault requires both confirm=true AND the exact literal DELETE", () => {
  assert.equal(shouldDeleteVault(true, "DELETE"), true);
  assert.equal(shouldDeleteVault(true, "delete"), false);
  assert.equal(shouldDeleteVault(true, "Delete"), false);
  assert.equal(shouldDeleteVault(true, "DELETE "), false);
  assert.equal(shouldDeleteVault(true, " DELETE"), false);
  assert.equal(shouldDeleteVault(true, ""), false);
  assert.equal(shouldDeleteVault(true, "yes"), false);
  assert.equal(shouldDeleteVault(false, "DELETE"), false, "a single yes can never destroy notes");
});

test("performUninstall preserves the vault when deleteVault is false", () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-uninstall-test-"));
  const root = join(dir, "root");
  const installDir = join(root, "app");
  const vaultPath = join(root, "vault");
  mkdirSync(installDir, { recursive: true });
  mkdirSync(vaultPath, { recursive: true });
  writeFileSync(join(vaultPath, "note.md"), "important notes");
  try {
    performUninstall(installDir, vaultPath, root, { removeInstallDir: true, deleteVault: false, removeConfig: false });
    assert.equal(existsSync(installDir), false, "install dir removed as requested");
    assert.equal(existsSync(vaultPath), true, "vault must survive");
    assert.equal(existsSync(join(vaultPath, "note.md")), true, "vault contents must survive");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("performUninstall deletes the vault only when explicitly instructed", () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-uninstall-test-"));
  const root = join(dir, "root");
  const installDir = join(root, "app");
  const vaultPath = join(root, "vault");
  mkdirSync(installDir, { recursive: true });
  mkdirSync(vaultPath, { recursive: true });
  writeFileSync(join(vaultPath, "note.md"), "important notes");
  try {
    performUninstall(installDir, vaultPath, root, { removeInstallDir: false, deleteVault: true, removeConfig: false });
    assert.equal(existsSync(installDir), true, "install dir preserved");
    assert.equal(existsSync(vaultPath), false, "vault deleted as explicitly instructed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("performUninstall removes config.json at root, not inside installDir", () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-uninstall-test-"));
  const root = join(dir, "root");
  const installDir = join(root, "app");
  const vaultPath = join(root, "vault");
  mkdirSync(installDir, { recursive: true });
  mkdirSync(vaultPath, { recursive: true });
  writeFileSync(join(root, "config.json"), "{}");
  try {
    performUninstall(installDir, vaultPath, root, { removeInstallDir: false, deleteVault: false, removeConfig: true });
    assert.equal(existsSync(join(root, "config.json")), false, "root config.json removed");
    assert.equal(existsSync(installDir), true, "install dir preserved");
    assert.equal(existsSync(vaultPath), true, "vault preserved");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
