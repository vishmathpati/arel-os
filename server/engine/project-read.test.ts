import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PROTOCOL_PATHS, readProtocol } from "./project-read.ts";

let repo: string;

beforeEach(async () => {
  repo = await fs.mkdtemp(join(tmpdir(), "arelos-repo-"));
  await fs.mkdir(join(repo, "agents"), { recursive: true });
  await fs.mkdir(join(repo, "docs"), { recursive: true });
  await fs.writeFile(join(repo, "CLAUDE.md"), "# CLAUDE\nentry point\n");
  await fs.writeFile(join(repo, "agents", "STATUS.md"), "# Status\nhealthy\n");
  await fs.writeFile(join(repo, "agents", "ROADMAP.md"), "# Roadmap\nphase 1\n");
  await fs.writeFile(join(repo, "docs", "INDEX.md"), "# Index\nmap\n");
  // A code file that must NEVER be read.
  await fs.writeFile(join(repo, "secret.ts"), "export const API_KEY = 'nope';\n");
});

afterEach(async () => {
  await fs.rm(repo, { recursive: true, force: true });
});

describe("readProtocol", () => {
  it("reads only the fixed protocol allowlist, never code", async () => {
    const result = await readProtocol(repo);
    expect(result.status).toBe("ok");
    const paths = result.files.map((f) => f.path).sort();
    expect(paths).toEqual(["CLAUDE.md", "agents/ROADMAP.md", "agents/STATUS.md", "docs/INDEX.md"]);
    // No code file ever appears.
    expect(result.contents.some((c) => c.path.endsWith(".ts"))).toBe(false);
    // Every read path is in the declared allowlist.
    for (const p of paths) expect(PROTOCOL_PATHS.has(p)).toBe(true);
  });

  it("fingerprints each file (sha256 + bytes + mtime)", async () => {
    const result = await readProtocol(repo);
    const entry = result.manifest.find((m) => m.path === "agents/STATUS.md");
    expect(entry?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(entry?.bytes).toBeGreaterThan(0);
    expect(entry?.mtime).toBeTruthy();
  });

  it("reports nothing changed against an identical prior manifest", async () => {
    const first = await readProtocol(repo);
    const second = await readProtocol(repo, first.manifest);
    expect(second.unchanged).toBe(true);
    expect(second.changed).toEqual([]);
  });

  it("detects an edited file", async () => {
    const first = await readProtocol(repo);
    await fs.writeFile(join(repo, "agents", "STATUS.md"), "# Status\nblocked now\n");
    const second = await readProtocol(repo, first.manifest);
    expect(second.unchanged).toBe(false);
    expect(second.changed).toContain("agents/STATUS.md");
  });

  it("detects a removed file", async () => {
    const first = await readProtocol(repo);
    await fs.rm(join(repo, "docs", "INDEX.md"));
    const second = await readProtocol(repo, first.manifest);
    expect(second.changed).toContain("docs/INDEX.md");
  });

  it("flags a missing folder", async () => {
    const result = await readProtocol(join(repo, "does-not-exist"));
    expect(result.status).toBe("folder-missing");
    expect(result.files).toEqual([]);
  });
});
