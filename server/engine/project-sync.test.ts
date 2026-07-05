import { describe, expect, it } from "vitest";
import type { ProjectSnapshot } from "../../src/shared/lib/project-dashboard/snapshot.ts";
import type { ProtocolFile } from "./project-read.ts";
import { buildSynthesisInput } from "./project-sync.ts";
import { assembleSnapshot } from "./snapshot-schema.ts";

/** A complete authored object → a valid prior snapshot via assembleSnapshot. */
const PRIOR: ProjectSnapshot = assembleSnapshot(
  {
    overview: {
      headline: "In beta",
      state: "watch",
      current: "polishing",
      recent: [{ title: "shipped auth", detail: "OAuth" }],
      next: [{ title: "launch", detail: null }],
      blocked: [],
    },
    whatChanged: [{ version: "1.4", date: null, items: ["did a thing"] }],
    roadmap: [{ phase: "Beta", status: "active", detail: null, items: ["x"] }],
    decisions: [{ title: "Use Supabase", decided: "Supabase", rejected: null, why: "RLS" }],
    structure: {
      layers: ["React", "Postgres"],
      folders: [{ name: "src", role: "app" }],
      dataFlow: [{ from: "UI", to: "API", label: null }],
    },
    designFeel: {
      stack: [{ name: "React", role: "frontend" }],
      brand: { name: "Acme", tagline: null, audience: null, problem: null },
      direction: "clean",
      principles: ["fast"],
    },
  },
  {
    project: "acme",
    syncedAt: "2026-06-23T00:00:00.000Z",
    repoPresent: true,
    manifest: [{ path: "agents/STATUS.md", sha256: "old", mtime: "", bytes: 10 }],
    files: [],
    tokens: null,
  },
);

function file(path: string, title: string, content: string): ProtocolFile {
  return { path, title, category: "status", bytes: content.length, lines: 1, content };
}

const ALL_CONTENTS: ProtocolFile[] = [
  file("CLAUDE.md", "Claude", "claude body"),
  file("agents/STATUS.md", "Status", "status body — changed"),
  file("agents/BRIEF.md", "Brief", "brief body"),
];

describe("buildSynthesisInput", () => {
  it("full synthesis (no prior) sends every doc, no merge base", () => {
    const { system, prompt } = buildSynthesisInput("acme", null, {
      contents: ALL_CONTENTS,
      changed: ALL_CONTENTS.map((c) => c.path),
    });
    expect(system).not.toContain("DELTA UPDATE");
    expect(prompt).not.toContain("Merge base");
    // every doc present
    expect(prompt).toContain("claude body");
    expect(prompt).toContain("status body — changed");
    expect(prompt).toContain("brief body");
  });

  it("delta re-sync sends only changed docs + the merge base, not unchanged docs", () => {
    const { system, prompt } = buildSynthesisInput("acme", PRIOR, {
      contents: ALL_CONTENTS,
      changed: ["agents/STATUS.md"],
    });
    expect(system).toContain("DELTA UPDATE");
    // merge base carries the prior authored prose forward
    expect(prompt).toContain("Merge base");
    expect(prompt).toContain("In beta"); // prior overview headline
    expect(prompt).toContain("Use Supabase"); // prior decision
    // only the changed file's content is sent
    expect(prompt).toContain("status body — changed");
    expect(prompt).not.toContain("claude body");
    expect(prompt).not.toContain("brief body");
    // the changed-path list is surfaced for removal detection
    expect(prompt).toContain("agents/STATUS.md");
  });

  it("delta merge base excludes design tokens (never model-authored)", () => {
    const { prompt } = buildSynthesisInput("acme", PRIOR, {
      contents: ALL_CONTENTS,
      changed: ["agents/STATUS.md"],
    });
    // The merge base JSON carries designFeel prose but no `tokens` key.
    const mergeBase = prompt.slice(prompt.indexOf("Merge base"));
    expect(mergeBase).toContain('"direction"');
    expect(mergeBase).not.toContain('"tokens"');
  });

  it("a changed path with no matching doc (removed) still appears in the changed list", () => {
    const { prompt } = buildSynthesisInput("acme", PRIOR, {
      contents: ALL_CONTENTS,
      changed: ["agents/STATUS.md", "agents/ROADMAP.md"], // ROADMAP removed (absent from contents)
    });
    expect(prompt).toContain("agents/ROADMAP.md");
    // but its content is not sent (it's gone)
    expect(prompt).not.toContain("roadmap body");
  });
});
