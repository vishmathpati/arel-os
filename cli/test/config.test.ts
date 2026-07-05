import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("writeConfig then readConfig round-trips and writes atomically (no .tmp left behind)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rlo-config-test-"));
  const configFile = join(dir, "config.json");
  process.env.ARELOS_CONFIG_PATH = configFile;
  try {
    // Fresh import per-test would require cache busting; instead re-import
    // via dynamic import with a cache-busting query so ARELOS_CONFIG_PATH
    // (read at module load inside paths.ts via a function, not cached) applies.
    const { writeConfig, readConfig } = await import("../src/config.js");

    assert.equal(readConfig(), null, "no config yet");

    writeConfig({
      version: 1,
      displayName: "Test Brain",
      installDir: join(dir, "install"),
      vaultPath: join(dir, "vault"),
      webPort: 1400,
      vaultPort: 5300,
    });

    assert.ok(existsSync(configFile));
    assert.ok(!existsSync(`${configFile}.tmp`), "tmp file should be renamed away");

    const loaded = readConfig();
    assert.deepEqual(loaded, {
      version: 1,
      displayName: "Test Brain",
      installDir: join(dir, "install"),
      vaultPath: join(dir, "vault"),
      webPort: 1400,
      vaultPort: 5300,
    });

    const raw = readFileSync(configFile, "utf8");
    assert.ok(raw.endsWith("\n"));
  } finally {
    delete process.env.ARELOS_CONFIG_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readConfig throws on an unsupported version", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rlo-config-test-"));
  const configFile = join(dir, "config.json");
  process.env.ARELOS_CONFIG_PATH = configFile;
  try {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(configFile, JSON.stringify({ version: 2 }));
    const { readConfig } = await import("../src/config.js");
    assert.throws(() => readConfig(), /Invalid or unsupported config/);
  } finally {
    delete process.env.ARELOS_CONFIG_PATH;
    rmSync(dir, { recursive: true, force: true });
  }
});
