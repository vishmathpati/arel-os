import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPlanToConfig, buildPortChangePlan, portsCommand, type RestartEffects } from "../src/ports-command.js";
import type { PortResolution } from "../src/install-plan.js";
import type { ArelConfig } from "../src/config.js";

function freeResolver(overrides: Record<number, PortResolution> = {}) {
  return async (port: number): Promise<PortResolution> =>
    overrides[port] ?? { requested: port, resolved: port, wasFree: true };
}

function occupiedResolver(occupied: Set<number>, nextFree: number) {
  return async (port: number): Promise<PortResolution> => {
    if (occupied.has(port)) return { requested: port, resolved: nextFree, wasFree: false };
    return { requested: port, resolved: port, wasFree: true };
  };
}

test("buildPortChangePlan: no requested ports -> no change", async () => {
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: null, vaultPort: null },
    freeResolver(),
  );
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.plan.anyChange, false);
    assert.equal(outcome.plan.web.changed, false);
    assert.equal(outcome.plan.vault.changed, false);
  }
});

test("buildPortChangePlan: requesting the same value as current -> no change (no validation needed)", async () => {
  let called = false;
  const resolver = async (port: number): Promise<PortResolution> => {
    called = true;
    return { requested: port, resolved: port, wasFree: true };
  };
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: 1347, vaultPort: null },
    resolver,
  );
  assert.equal(outcome.ok, true);
  if (outcome.ok) assert.equal(outcome.plan.anyChange, false);
  assert.equal(called, false, "resolvePort must not be called for an unchanged value");
});

test("buildPortChangePlan: valid new web port -> plan reflects the change", async () => {
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: 1400, vaultPort: null },
    freeResolver(),
  );
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.plan.anyChange, true);
    assert.equal(outcome.plan.web.changed, true);
    assert.equal(outcome.plan.web.requested, 1400);
    assert.equal(outcome.plan.vault.changed, false);
  }
});

test("buildPortChangePlan: both ports changed", async () => {
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: 1400, vaultPort: 5300 },
    freeResolver(),
  );
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.plan.web.requested, 1400);
    assert.equal(outcome.plan.vault.requested, 5300);
    assert.equal(outcome.plan.anyChange, true);
  }
});

test("buildPortChangePlan: hard-fails when the requested web port is occupied (no nearby suggestion)", async () => {
  const resolver = occupiedResolver(new Set([1400]), 1401);
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: 1400, vaultPort: null },
    resolver,
  );
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.message, /1400 is already in use/);
});

test("buildPortChangePlan: hard-fails when the requested vault port is occupied", async () => {
  const resolver = occupiedResolver(new Set([5300]), 5301);
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: null, vaultPort: 5300 },
    resolver,
  );
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.message, /5300 is already in use/);
});

test("buildPortChangePlan: rejects identical requested web/vault ports", async () => {
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: 1400, vaultPort: 1400 },
    freeResolver(),
  );
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.message, /must differ/);
});

test("buildPortChangePlan: rejects a new web port that collides with the unchanged current vault port", async () => {
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: 5274, vaultPort: null },
    freeResolver(),
  );
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.message, /must differ/);
});

test("buildPortChangePlan: rejects a new vault port that collides with the unchanged current web port", async () => {
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: null, vaultPort: 1347 },
    freeResolver(),
  );
  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.match(outcome.message, /must differ/);
});

test("buildPortChangePlan: allows swapping web/vault ports with each other", async () => {
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: 5274, vaultPort: 1347 },
    freeResolver(),
  );
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.equal(outcome.plan.web.requested, 5274);
    assert.equal(outcome.plan.vault.requested, 1347);
  }
});

test("applyPlanToConfig only overwrites fields the plan marks as changed", async () => {
  const config: ArelConfig = {
    version: 1,
    displayName: "Test Brain",
    root: "/tmp/root",
    installDir: "/tmp/root/app",
    vaultPath: "/tmp/root/vault",
    webPort: 1347,
    vaultPort: 5274,
  };
  const outcome = await buildPortChangePlan(
    { webPort: 1347, vaultPort: 5274 },
    { webPort: 1400, vaultPort: null },
    freeResolver(),
  );
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  const updated = applyPlanToConfig(config, outcome.plan);
  assert.equal(updated.webPort, 1400);
  assert.equal(updated.vaultPort, 5274);
  // Original untouched (pure function).
  assert.equal(config.webPort, 1347);
});

function writeConfigAt(root: string, overrides: Partial<ArelConfig> = {}): ArelConfig {
  mkdirSync(root, { recursive: true });
  const config: ArelConfig = {
    version: 1,
    displayName: "Test Brain",
    root,
    installDir: join(root, "app"),
    vaultPath: join(root, "vault"),
    webPort: 1347,
    vaultPort: 5274,
    serviceLabels: { web: "com.arelos.abc12345.web", vault: "com.arelos.abc12345.vault" },
    ...overrides,
  };
  writeFileSync(join(root, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

/** Records the exact sequence of injected-effect calls for assertion. */
function recordingEffects(healthy: boolean): { effects: RestartEffects; calls: string[] } {
  const calls: string[] = [];
  const effects: RestartEffects = {
    restartServices: async (labels) => {
      calls.push(`restart:${labels.web}:${labels.vault}`);
      return { errors: [] };
    },
    waitForHealthy: async (webPort, vaultPort) => {
      calls.push(`health:${webPort}:${vaultPort}`);
      return {
        healthy,
        vault: { up: healthy, vaultPort },
        web: { up: healthy, status: healthy ? 200 : undefined },
      };
    },
  };
  return { effects, calls };
}

test("portsCommand (non-interactive flags): rewrites config, restarts services, health-checks new ports, in that order", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-ports-cmd-test-"));
  const registryFile = join(dir, "installs.json");
  const root = join(dir, "brain");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    writeConfigAt(root);
    const { addRegistryEntry } = await import("../src/registry.js");
    addRegistryEntry({ name: "Test Brain", slug: "test-brain", root, createdAt: "2026-01-01T00:00:00.000Z" });

    const { effects, calls } = recordingEffects(true);
    const code = await portsCommand({ webPort: 1400, vaultPort: null }, "Test Brain", effects);
    assert.equal(code, 0);

    assert.deepEqual(calls, [
      "restart:com.arelos.abc12345.web:com.arelos.abc12345.vault",
      "health:1400:5274",
    ]);

    const updated = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
    assert.equal(updated.webPort, 1400);
    assert.equal(updated.vaultPort, 5274);
    assert.ok(!existsSync(join(root, "config.json.tmp")), "no leftover tmp file");
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("portsCommand: no-op when requested ports equal current (never restarts)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-ports-cmd-test-"));
  const registryFile = join(dir, "installs.json");
  const root = join(dir, "brain");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    writeConfigAt(root);
    const { addRegistryEntry } = await import("../src/registry.js");
    addRegistryEntry({ name: "Test Brain", slug: "test-brain", root, createdAt: "2026-01-01T00:00:00.000Z" });

    const { effects, calls } = recordingEffects(true);
    const code = await portsCommand({ webPort: 1347, vaultPort: 5274 }, "Test Brain", effects);
    assert.equal(code, 0);
    assert.deepEqual(calls, []);
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("portsCommand: hard-fails on an occupied requested port, writes no config, never restarts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-ports-cmd-test-"));
  const registryFile = join(dir, "installs.json");
  const root = join(dir, "brain");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    writeConfigAt(root);
    const { addRegistryEntry } = await import("../src/registry.js");
    addRegistryEntry({ name: "Test Brain", slug: "test-brain", root, createdAt: "2026-01-01T00:00:00.000Z" });

    // Occupy the target port for real so the actual resolvePort (used by the
    // command when no override is injected) reports it taken.
    const { createServer } = await import("node:net");
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(58311, "127.0.0.1", resolve));
    try {
      const { calls } = recordingEffects(true);
      const effects: RestartEffects = {
        restartServices: async (labels) => {
          calls.push(`restart:${labels.web}`);
          return { errors: [] };
        },
        waitForHealthy: async () => {
          calls.push("health");
          return { healthy: true, vault: { up: true }, web: { up: true } };
        },
      };
      const code = await portsCommand({ webPort: 58311, vaultPort: null }, "Test Brain", effects);
      assert.equal(code, 1);
      assert.deepEqual(calls, [], "must never restart when validation fails");

      const stillOriginal = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
      assert.equal(stillOriginal.webPort, 1347, "config must be untouched on failure");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("portsCommand: health-check timeout after a successful config change and restart returns failure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-ports-cmd-test-"));
  const registryFile = join(dir, "installs.json");
  const root = join(dir, "brain");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    writeConfigAt(root);
    const { addRegistryEntry } = await import("../src/registry.js");
    addRegistryEntry({ name: "Test Brain", slug: "test-brain", root, createdAt: "2026-01-01T00:00:00.000Z" });

    const { effects, calls } = recordingEffects(false);
    const code = await portsCommand({ webPort: 1400, vaultPort: null }, "Test Brain", effects);
    assert.equal(code, 1);
    assert.deepEqual(calls, [
      "restart:com.arelos.abc12345.web:com.arelos.abc12345.vault",
      "health:1400:5274",
    ]);

    // Config was still written even though health failed — the change was
    // real and the diagnostics point the user at `arelos logs`.
    const updated = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
    assert.equal(updated.webPort, 1400);
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("portsCommand: unknown install name errors before touching config or effects", async () => {
  const dir = mkdtempSync(join(tmpdir(), "arelos-ports-cmd-test-"));
  const registryFile = join(dir, "installs.json");
  const root = join(dir, "brain");
  process.env.ARELOS_REGISTRY_PATH = registryFile;
  try {
    writeConfigAt(root);
    const { addRegistryEntry } = await import("../src/registry.js");
    addRegistryEntry({ name: "Test Brain", slug: "test-brain", root, createdAt: "2026-01-01T00:00:00.000Z" });

    const { effects, calls } = recordingEffects(true);
    const code = await portsCommand({ webPort: 1400, vaultPort: null }, "Nope", effects);
    assert.equal(code, 1);
    assert.deepEqual(calls, []);
  } finally {
    delete process.env.ARELOS_REGISTRY_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});
