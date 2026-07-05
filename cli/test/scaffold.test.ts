import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureEnvFile, ensureLogsDir, isDirEmpty, scaffoldVault, TemplateVaultMissingError } from "../src/scaffold.js";

// import.meta.dirname is dist-test/test/ once compiled; walk up to the repo root
// (cli/ is one level below the app repo root).
const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

test("isDirEmpty treats a nonexistent dir as empty", () => {
  assert.equal(isDirEmpty(join(tmpdir(), "rlo-does-not-exist-abc")), true);
});

test("scaffoldVault throws TemplateVaultMissingError when templates/vault is absent from installDir", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlo-scaffold-test-"));
  try {
    assert.throws(() => scaffoldVault(dir, join(dir, "vault")), TemplateVaultMissingError);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scaffoldVault copies the real repo's templates/vault into an empty destination", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlo-scaffold-test-"));
  const vaultDest = join(dir, "vault");
  try {
    // Simulate an installDir by symlinking/copying just the templates dir
    // reference: point scaffoldVault at the real repo root, which has a real
    // templates/vault, and scaffold into a scratch destination.
    const result = scaffoldVault(REPO_ROOT, vaultDest);
    assert.equal(result.copied, true);
    assert.ok(existsSync(join(vaultDest, "areas")));
    assert.ok(existsSync(join(vaultDest, "system", "recipes", "context.md")));

    // Diff file count against the source template.
    const countFiles = (base: string): string[] => {
      const out: string[] = [];
      const walk = (d: string) => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          const p = join(d, entry.name);
          if (entry.isDirectory()) walk(p);
          else out.push(p.slice(base.length));
        }
      };
      walk(base);
      return out.sort();
    };
    const sourceFiles = countFiles(join(REPO_ROOT, "templates", "vault"));
    const destFiles = countFiles(vaultDest);
    assert.deepEqual(destFiles, sourceFiles, "scaffolded vault must match the template file-for-file");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scaffoldVault does not overwrite a non-empty destination", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlo-scaffold-test-"));
  const vaultDest = join(dir, "vault");
  mkdirSync(vaultDest);
  writeFileSync(join(vaultDest, "my-existing-note.md"), "do not touch");
  try {
    const result = scaffoldVault(REPO_ROOT, vaultDest);
    assert.equal(result.copied, false);
    assert.ok(existsSync(join(vaultDest, "my-existing-note.md")));
    assert.ok(!existsSync(join(vaultDest, "areas")), "must not merge template into existing vault");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ensureLogsDir creates logs/service under installDir", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlo-scaffold-test-"));
  try {
    const logsDir = ensureLogsDir(dir);
    assert.equal(logsDir, join(dir, "logs", "service"));
    assert.ok(existsSync(logsDir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ensureEnvFile copies .env.example to .env only when .env is absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "rlo-scaffold-test-"));
  try {
    writeFileSync(join(dir, ".env.example"), "AI_GATEWAY_API_KEY=\n");
    const first = ensureEnvFile(dir);
    assert.equal(first.created, true);
    assert.ok(existsSync(join(dir, ".env")));

    writeFileSync(join(dir, ".env"), "AI_GATEWAY_API_KEY=user-secret\n");
    const second = ensureEnvFile(dir);
    assert.equal(second.created, false, "must never overwrite an existing .env");
    assert.equal(readFileSync(join(dir, ".env"), "utf8"), "AI_GATEWAY_API_KEY=user-secret\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
