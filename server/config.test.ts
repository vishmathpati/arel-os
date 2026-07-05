import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `server/config.ts` freezes CONFIG_PATH from `ARELOS_CONFIG_PATH` at MODULE
// LOAD TIME (a top-level `const`), so the env var must be set before the
// module is first imported — see server/env.test.ts for the same constraint.
// We isolate the module graph per test with `vi.resetModules()` + dynamic
// import so each test gets a fresh CONFIG_PATH binding.

let dir: string;
let configPath: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), "arelos-config-test-"));
  configPath = join(dir, "config.json");
  process.env.ARELOS_CONFIG_PATH = configPath;
  process.env.ARELOS_VAULT_PORT = undefined;
  process.env.ARELOS_WEB_PORT = undefined;
});

afterEach(async () => {
  process.env.ARELOS_CONFIG_PATH = undefined;
  process.env.ARELOS_VAULT_PORT = undefined;
  process.env.ARELOS_WEB_PORT = undefined;
  await fs.rm(dir, { recursive: true, force: true });
});

async function freshLoadConfig() {
  vi.resetModules();
  const mod = await import("./config.ts");
  return mod.loadConfig;
}

describe("loadConfig — port precedence (config.json vs env var)", () => {
  it("config PRESENT + env UNSET → config.json's vaultPort/webPort win", async () => {
    await fs.writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        displayName: "Test",
        installDir: dir,
        vaultPath: join(dir, "vault"),
        webPort: 1400,
        vaultPort: 5300,
      }),
    );
    const loadConfig = await freshLoadConfig();
    const config = loadConfig();
    expect(config.vaultPort).toBe(5300);
    expect(config.webPort).toBe(1400);
  });

  it("config PRESENT + env SET to a conflicting port → config.json still wins (regression: precedence must not invert)", async () => {
    await fs.writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        displayName: "Test",
        installDir: dir,
        vaultPath: join(dir, "vault"),
        webPort: 1400,
        vaultPort: 5300,
      }),
    );
    process.env.ARELOS_VAULT_PORT = "9999";
    process.env.ARELOS_WEB_PORT = "8888";
    const loadConfig = await freshLoadConfig();
    const config = loadConfig();
    expect(config.vaultPort).toBe(5300);
    expect(config.webPort).toBe(1400);
  });

  it("config ABSENT + env SET → the env var is honored as a dev-fallback", async () => {
    process.env.ARELOS_VAULT_PORT = "9999";
    process.env.ARELOS_WEB_PORT = "8888";
    const loadConfig = await freshLoadConfig();
    const config = loadConfig();
    expect(config.vaultPort).toBe(9999);
    expect(config.webPort).toBe(8888);
  });

  it("config ABSENT + env UNSET → the hardcoded dev defaults apply", async () => {
    const loadConfig = await freshLoadConfig();
    const config = loadConfig();
    expect(config.vaultPort).toBe(5274);
    expect(config.webPort).toBe(1347);
  });
});
