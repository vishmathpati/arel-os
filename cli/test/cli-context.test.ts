import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function writeConfigAt(root: string, overrides: Partial<Record<string, unknown>> = {}) {
  mkdirSync(root, { recursive: true });
  const config = {
    version: 1,
    displayName: "Test Brain",
    root,
    installDir: join(root, "app"),
    vaultPath: join(root, "vault"),
    webPort: 1400,
    vaultPort: 5300,
    ...overrides,
  };
  writeFileSync(join(root, "config.json"), JSON.stringify(config, null, 2));
}

test("resolveInstall errors when no installs are registered and no legacy config exists", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-context-test-"));
  const registryFile = join(dir, "installs.json");
  const legacyConfig = join(dir, "does-not-exist-config.json");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  process.env.ARELOS_CONFIG_PATH = legacyConfig;
  try {
    const { resolveInstall } = await import("../src/cli-context.js");
    const result = await resolveInstall({ interactive: false });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /No Arel OS install found/);
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    delete process.env.ARELOS_CONFIG_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveInstall auto-picks the single registered install with no name given", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-context-test-"));
  const registryFile = join(dir, "installs.json");
  const root = join(dir, "only-brain");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { addRegistryEntry } = await import("../src/registry.js");
    writeConfigAt(root);
    addRegistryEntry({ name: "Only Brain", slug: "only-brain", root, createdAt: "2026-01-01T00:00:00.000Z" });

    const { resolveInstall } = await import("../src/cli-context.js");
    const result = await resolveInstall({ interactive: false });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.install.name, "Only Brain");
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveInstall errors (non-interactively) when multiple installs exist and no name given", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-context-test-"));
  const registryFile = join(dir, "installs.json");
  const rootA = join(dir, "brain-a");
  const rootB = join(dir, "brain-b");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { addRegistryEntry } = await import("../src/registry.js");
    writeConfigAt(rootA);
    writeConfigAt(rootB);
    addRegistryEntry({ name: "Brain A", slug: "brain-a", root: rootA, createdAt: "2026-01-01T00:00:00.000Z" });
    addRegistryEntry({ name: "Brain B", slug: "brain-b", root: rootB, createdAt: "2026-01-02T00:00:00.000Z" });

    const { resolveInstall } = await import("../src/cli-context.js");
    const result = await resolveInstall({ interactive: false });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /Multiple Arel OS installs found/);
      assert.match(result.message, /Brain A/);
      assert.match(result.message, /Brain B/);
    }
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveInstall resolves by exact name among multiple installs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-context-test-"));
  const registryFile = join(dir, "installs.json");
  const rootA = join(dir, "brain-a");
  const rootB = join(dir, "brain-b");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { addRegistryEntry } = await import("../src/registry.js");
    writeConfigAt(rootA, { displayName: "Brain A" });
    writeConfigAt(rootB, { displayName: "Brain B" });
    addRegistryEntry({ name: "Brain A", slug: "brain-a", root: rootA, createdAt: "2026-01-01T00:00:00.000Z" });
    addRegistryEntry({ name: "Brain B", slug: "brain-b", root: rootB, createdAt: "2026-01-02T00:00:00.000Z" });

    const { resolveInstall } = await import("../src/cli-context.js");
    const result = await resolveInstall({ name: "Brain B", interactive: false });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.install.config.displayName, "Brain B");
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("resolveInstall errors listing known installs when the given name doesn't match", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-context-test-"));
  const registryFile = join(dir, "installs.json");
  const root = join(dir, "only-brain");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    const { addRegistryEntry } = await import("../src/registry.js");
    writeConfigAt(root);
    addRegistryEntry({ name: "Only Brain", slug: "only-brain", root, createdAt: "2026-01-01T00:00:00.000Z" });

    const { resolveInstall } = await import("../src/cli-context.js");
    const result = await resolveInstall({ name: "Nope", interactive: false });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /No install named "Nope"/);
      assert.match(result.message, /Only Brain/);
    }
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});
