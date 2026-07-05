import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  VaultNotFoundError,
  VaultPathError,
  absVaultPath,
  listVaultDir,
  readFrontmatter,
  readVaultFile,
  resolveVaultPath,
  resolveWikilink,
  softDeleteVaultFile,
  writeVaultFile,
} from "./io.ts";

let root: string;

beforeAll(async () => {
  root = await fs.mkdtemp(join(tmpdir(), "arelos-vault-"));
});

afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("resolveVaultPath", () => {
  it("rejects traversal outside the vault", () => {
    expect(() => resolveVaultPath("../etc/passwd", root)).toThrow(VaultPathError);
  });

  it("resolves a path inside the vault", () => {
    expect(resolveVaultPath("tasks/x.md", root)).toBe(join(root, "tasks/x.md"));
  });
});

describe("write → read roundtrip", () => {
  it("persists frontmatter + body and stamps timestamps", async () => {
    const result = await writeVaultFile(
      "tasks/buy-milk.md",
      { type: "task", title: "Buy milk", status: "open", notify: false },
      "Get 2%.",
      root,
    );
    expect(result.frontmatter.created).toBeTruthy();
    expect(result.frontmatter.updated).toBeTruthy();

    // File actually exists on disk.
    const onDisk = await fs.readFile(absVaultPath("tasks/buy-milk.md", root), "utf8");
    expect(onDisk).toContain("title: Buy milk");

    const doc = await readVaultFile("tasks/buy-milk.md", root);
    expect(doc.frontmatter.title).toBe("Buy milk");
    expect(doc.body).toBe("Get 2%.");

    const { frontmatter } = await readFrontmatter("tasks/buy-milk.md", root);
    expect(frontmatter.type).toBe("task");
  });

  it("preserves created across rewrites", async () => {
    const first = await writeVaultFile(
      "tasks/keep.md",
      { type: "task", status: "open", notify: false },
      "a",
      root,
    );
    const second = await writeVaultFile(
      "tasks/keep.md",
      { ...first.frontmatter, status: "done" },
      "b",
      root,
    );
    expect(second.frontmatter.created).toBe(first.frontmatter.created);
  });

  it("throws VaultNotFoundError for a missing file", async () => {
    await expect(readVaultFile("tasks/nope.md", root)).rejects.toThrow(VaultNotFoundError);
  });
});

describe("listVaultDir", () => {
  it("lists .md files in a directory", async () => {
    const entries = await listVaultDir("tasks", root);
    const paths = entries.map((e) => e.path);
    expect(paths).toContain("tasks/buy-milk.md");
    expect(entries.every((e) => e.type === "file")).toBe(true);
  });

  it("returns an empty list for a missing directory", async () => {
    expect(await listVaultDir("does-not-exist", root)).toEqual([]);
  });
});

describe("softDeleteVaultFile", () => {
  it("moves the file to archive/deleted with markers", async () => {
    await writeVaultFile(
      "tasks/trash-me.md",
      { type: "task", status: "open", notify: false },
      "bye",
      root,
    );
    const { archivedPath } = await softDeleteVaultFile("tasks/trash-me.md", root);
    expect(archivedPath).toBe("archive/deleted/tasks/trash-me.md");

    // Original is gone.
    await expect(readVaultFile("tasks/trash-me.md", root)).rejects.toThrow(VaultNotFoundError);

    // Archive copy carries the soft-delete markers.
    const archived = await readVaultFile(archivedPath, root);
    expect(archived.frontmatter.deleted).toBe(true);
    expect(archived.frontmatter.deleted_from).toBe("tasks/trash-me.md");
  });
});

describe("resolveWikilink", () => {
  it("resolves a flat-leaf stem to its path", async () => {
    await writeVaultFile(
      "tasks/findable.md",
      { type: "task", status: "open", notify: false },
      "",
      root,
    );
    expect(await resolveWikilink("[[findable]]", root)).toBe("tasks/findable.md");
  });

  it("resolves a folder-form container via _index.md", async () => {
    await writeVaultFile(
      "areas/health/_index.md",
      { type: "area", area: "health", name: "Health" },
      "",
      root,
    );
    expect(await resolveWikilink("[[health|Health]]", root)).toBe("areas/health/_index.md");
  });

  it("returns null for an unknown stem", async () => {
    expect(await resolveWikilink("[[ghost]]", root)).toBeNull();
  });
});
