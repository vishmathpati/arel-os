import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

// `server/config.ts` freezes CONFIG_PATH from `ARELOS_CONFIG_PATH` at MODULE LOAD
// TIME (a top-level `const`), not inside `loadConfig()`. So the env var must be
// set — and the module graph under test dynamically imported — before anything
// touches `./config.ts`, or it would silently fall through to the real
// `~/.arelos/config.json` (and write test data into the user's actual install).
let installDir: string;
let configPath: string;
let envMod: typeof import("./env.ts");

beforeAll(async () => {
  installDir = await fs.mkdtemp(join(tmpdir(), "arelos-install-"));
  const vaultPath = await fs.mkdtemp(join(tmpdir(), "arelos-vault-"));
  configPath = join(installDir, "config.json");
  await fs.writeFile(
    configPath,
    JSON.stringify({
      version: 1,
      displayName: "Test OS",
      installDir,
      vaultPath,
      webPort: 1347,
      vaultPort: 5274,
    }),
  );
  process.env.ARELOS_CONFIG_PATH = configPath;
  envMod = await import("./env.ts");
});

afterAll(async () => {
  process.env.ARELOS_CONFIG_PATH = undefined;
  await fs.rm(installDir, { recursive: true, force: true });
});

beforeEach(async () => {
  // Each test starts from a clean .env (config.json itself is untouched).
  await fs.rm(envMod.envFilePath(), { force: true });
});

describe("envFilePath", () => {
  it("is fixed to <installDir>/.env — never derived from a request", () => {
    expect(envMod.envFilePath()).toBe(join(installDir, ".env"));
  });
});

describe("writeEnvKeys — allowlist enforcement", () => {
  it("accepts every allowlisted key", async () => {
    for (const key of envMod.ALLOWED_ENV_KEYS) {
      const { keysSet } = await envMod.writeEnvKeys({ [key]: "some-value" });
      expect(keysSet).toEqual([key]);
    }
  });

  it("rejects a non-allowlisted key before writing anything", async () => {
    await expect(envMod.writeEnvKeys({ RANDOM_SECRET: "x" })).rejects.toThrow(
      envMod.DisallowedEnvKeyError,
    );
    const exists = await fs
      .access(envMod.envFilePath())
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("rejects the whole batch if any key in it is disallowed (no partial write)", async () => {
    await expect(
      envMod.writeEnvKeys({ AI_GATEWAY_API_KEY: "good", EVIL_KEY: "bad" }),
    ).rejects.toThrow(envMod.DisallowedEnvKeyError);
    const exists = await fs
      .access(envMod.envFilePath())
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("rejects path-traversal-flavored key names as simply disallowed", async () => {
    await expect(envMod.writeEnvKeys({ "../../etc/passwd": "x" })).rejects.toThrow(
      envMod.DisallowedEnvKeyError,
    );
  });
});

describe("writeEnvKeys — no-echo contract", () => {
  it("the return value never contains the written value, only key names", async () => {
    const result = await envMod.writeEnvKeys({ AI_GATEWAY_API_KEY: "sk-super-secret-value" });
    expect(result).toEqual({ keysSet: ["AI_GATEWAY_API_KEY"] });
    expect(JSON.stringify(result)).not.toContain("sk-super-secret-value");
  });
});

describe("writeEnvKeys — file behavior", () => {
  it("writes the key to .env at the fixed install-root path", async () => {
    await envMod.writeEnvKeys({ AI_GATEWAY_API_KEY: "sk-abc123" });
    const contents = await fs.readFile(envMod.envFilePath(), "utf8");
    expect(contents).toContain("AI_GATEWAY_API_KEY=sk-abc123");
  });

  it("preserves other lines (comments, unrelated keys) on upsert", async () => {
    await fs.writeFile(
      envMod.envFilePath(),
      "# a comment\nARELOS_VAULT_PORT=5274\nAI_GATEWAY_API_KEY=old-value\n",
    );
    await envMod.writeEnvKeys({ AI_GATEWAY_API_KEY: "new-value" });
    const contents = await fs.readFile(envMod.envFilePath(), "utf8");
    expect(contents).toContain("# a comment");
    expect(contents).toContain("ARELOS_VAULT_PORT=5274");
    expect(contents).toContain("AI_GATEWAY_API_KEY=new-value");
    expect(contents).not.toContain("old-value");
  });

  it("appends a new key without disturbing existing lines", async () => {
    await fs.writeFile(envMod.envFilePath(), "ARELOS_VAULT_PORT=5274\n");
    await envMod.writeEnvKeys({ ARELOS_ENGINE_MODEL: "anthropic/claude-haiku-4.5" });
    const contents = await fs.readFile(envMod.envFilePath(), "utf8");
    expect(contents).toContain("ARELOS_VAULT_PORT=5274");
    expect(contents).toContain("ARELOS_ENGINE_MODEL=anthropic/claude-haiku-4.5");
  });

  it("quotes values containing whitespace", async () => {
    await envMod.writeEnvKeys({ ARELOS_ENGINE_FALLBACK: "model one, model two" });
    const contents = await fs.readFile(envMod.envFilePath(), "utf8");
    expect(contents).toContain('ARELOS_ENGINE_FALLBACK="model one, model two"');
  });

  it("makes the value available on process.env immediately", async () => {
    await envMod.writeEnvKeys({ AI_GATEWAY_API_KEY: "sk-live-now" });
    expect(process.env.AI_GATEWAY_API_KEY).toBe("sk-live-now");
  });
});
