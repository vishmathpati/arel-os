import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractDesignTokens } from "./design-tokens.ts";

let repo: string;

beforeEach(async () => {
  repo = await fs.mkdtemp(join(tmpdir(), "arelos-tokens-"));
  await fs.mkdir(join(repo, "src"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(repo, { recursive: true, force: true });
});

const CSS = `
:root {
  --background: oklch(0.98 0 0);
  --foreground: #111111;
  --primary: var(--foreground); /* same as text */
  --radius-md: 6px;
}
.dark {
  --background: oklch(0.18 0 0);
  --foreground: oklch(0.97 0 0);
}
@theme inline {
  --font-sans: Inter, sans-serif;
  --text-body: 14px;
  --color-background: var(--background);
}
`;

describe("extractDesignTokens", () => {
  it("returns an empty set when nothing is found", async () => {
    const tokens = await extractDesignTokens(repo);
    expect(tokens.source).toBe("none");
    expect(tokens.light).toEqual([]);
  });

  it("parses :root and dark color tokens from CSS", async () => {
    await fs.writeFile(join(repo, "src", "index.css"), CSS);
    const tokens = await extractDesignTokens(repo);
    expect(tokens.source).toBe("css");

    const bg = tokens.light.find((t) => t.name === "background");
    expect(bg?.value).toBe("oklch(0.98 0 0)");

    const darkBg = tokens.dark.find((t) => t.name === "background");
    expect(darkBg?.value).toBe("oklch(0.18 0 0)");
  });

  it("resolves var() references to concrete values", async () => {
    await fs.writeFile(join(repo, "src", "index.css"), CSS);
    const tokens = await extractDesignTokens(repo);
    // --primary: var(--foreground) → #111111
    const primary = tokens.light.find((t) => t.name === "primary");
    expect(primary?.value).toBe("#111111");
  });

  it("extracts font family, font scale, and radius from @theme/:root", async () => {
    await fs.writeFile(join(repo, "src", "index.css"), CSS);
    const tokens = await extractDesignTokens(repo);
    expect(tokens.fonts.families.find((f) => f.name === "sans")?.value).toContain("Inter");
    expect(tokens.fonts.scale.find((s) => s.name === "body")?.pixels).toBe(14);
    expect(tokens.radius.find((r) => r.name === "md")?.pixels).toBe(6);
  });

  it("falls back to DESIGN.md css fences when there is no stylesheet", async () => {
    await fs.mkdir(join(repo, "agents"), { recursive: true });
    await fs.writeFile(
      join(repo, "agents", "DESIGN.md"),
      "# Design\n\n## Colors\n\n```css\n:root { --accent: #ff0000; }\n```\n",
    );
    const tokens = await extractDesignTokens(repo);
    expect(tokens.source).toBe("design.md");
    expect(tokens.light.some((t) => t.value === "#ff0000")).toBe(true);
  });
});
