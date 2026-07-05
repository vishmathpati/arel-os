import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("readRegistry returns an empty array when no registry file exists", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-registry-test-"));
  const registryFile = join(dir, "installs.json");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { readRegistry } = await import("../src/registry.js");
    assert.deepEqual(readRegistry(), []);
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addRegistryEntry appends and writes atomically (no .tmp left behind)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-registry-test-"));
  const registryFile = join(dir, "installs.json");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { addRegistryEntry, readRegistry } = await import("../src/registry.js");
    addRegistryEntry({ name: "Work Brain", slug: "work-brain", root: "/tmp/work-brain", createdAt: "2026-01-01T00:00:00.000Z" });
    assert.ok(existsSync(registryFile));
    assert.ok(!existsSync(`${registryFile}.tmp`), "tmp file should be renamed away");
    const entries = readRegistry();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, "Work Brain");
    const raw = readFileSync(registryFile, "utf8");
    assert.ok(raw.endsWith("\n"));
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addRegistryEntry replaces an existing entry at the same root (reinstall in place)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-registry-test-"));
  const registryFile = join(dir, "installs.json");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { addRegistryEntry, readRegistry } = await import("../src/registry.js");
    addRegistryEntry({ name: "Work Brain", slug: "work-brain", root: "/tmp/work-brain", createdAt: "2026-01-01T00:00:00.000Z" });
    addRegistryEntry({ name: "Work Brain", slug: "work-brain", root: "/tmp/work-brain", createdAt: "2026-02-02T00:00:00.000Z" });
    const entries = readRegistry();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].createdAt, "2026-02-02T00:00:00.000Z");
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("addRegistryEntry keeps distinct entries for different roots", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-registry-test-"));
  const registryFile = join(dir, "installs.json");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { addRegistryEntry, readRegistry } = await import("../src/registry.js");
    addRegistryEntry({ name: "Work Brain", slug: "work-brain", root: "/tmp/work-brain", createdAt: "2026-01-01T00:00:00.000Z" });
    addRegistryEntry({ name: "Personal Brain", slug: "personal-brain", root: "/tmp/personal-brain", createdAt: "2026-01-02T00:00:00.000Z" });
    const entries = readRegistry();
    assert.equal(entries.length, 2);
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("removeRegistryEntry removes only the matching root", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-registry-test-"));
  const registryFile = join(dir, "installs.json");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { addRegistryEntry, readRegistry, removeRegistryEntry } = await import("../src/registry.js");
    addRegistryEntry({ name: "Work Brain", slug: "work-brain", root: "/tmp/work-brain", createdAt: "2026-01-01T00:00:00.000Z" });
    addRegistryEntry({ name: "Personal Brain", slug: "personal-brain", root: "/tmp/personal-brain", createdAt: "2026-01-02T00:00:00.000Z" });
    removeRegistryEntry("/tmp/work-brain");
    const entries = readRegistry();
    assert.equal(entries.length, 1);
    assert.equal(entries[0].name, "Personal Brain");
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("findRegistryEntryByName matches by name or slug", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-registry-test-"));
  const registryFile = join(dir, "installs.json");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { addRegistryEntry, findRegistryEntryByName } = await import("../src/registry.js");
    addRegistryEntry({ name: "Work Brain", slug: "work-brain", root: "/tmp/work-brain", createdAt: "2026-01-01T00:00:00.000Z" });
    assert.equal(findRegistryEntryByName("Work Brain")?.root, "/tmp/work-brain");
    assert.equal(findRegistryEntryByName("work-brain")?.root, "/tmp/work-brain");
    assert.equal(findRegistryEntryByName("nope"), null);
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readRegistry throws on a malformed (non-array) registry file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-registry-test-"));
  const registryFile = join(dir, "installs.json");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(registryFile, JSON.stringify({ not: "an array" }));
    const { readRegistry } = await import("../src/registry.js");
    assert.throws(() => readRegistry(), /Invalid registry/);
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});
