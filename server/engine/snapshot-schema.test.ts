import { describe, expect, it } from "vitest";
import { parseSnapshot } from "../../src/shared/lib/project-dashboard/snapshot.ts";
import type { DesignTokens } from "../../src/shared/lib/project-dashboard/tokens.ts";
import { AuthoredSnapshotSchema, assembleSnapshot } from "./snapshot-schema.ts";

/** A minimal but complete authored object (what the model returns via generateObject). */
const AUTHORED = {
  overview: {
    headline: "In beta",
    state: "watch" as const,
    current: "polishing",
    recent: [{ title: "shipped auth", detail: "OAuth" }],
    next: [{ title: "launch", detail: null }],
    blocked: [],
  },
  whatChanged: [{ version: "1.4", date: null, items: ["a"] }],
  roadmap: [{ phase: "Beta", status: "active" as const, detail: null, items: ["x"] }],
  decisions: [{ title: "Use Supabase", decided: "Supabase", rejected: null, why: "RLS" }],
  structure: {
    layers: ["React", "Postgres"],
    folders: [{ name: "src", role: "app" }],
    dataFlow: [{ from: "UI", to: "API", label: null }],
  },
  designFeel: {
    stack: [{ name: "React", role: "frontend" }],
    brand: { name: "Snapfinder", tagline: null, audience: null, problem: null },
    direction: "clean",
    principles: ["fast"],
  },
};

const MANIFEST = [
  { path: "agents/STATUS.md", sha256: "abc", mtime: "2026-06-20T00:00:00.000Z", bytes: 120 },
];
const FILES = [
  { path: "agents/STATUS.md", title: "Status", category: "status" as const, bytes: 120, lines: 4 },
];
const TOKENS: DesignTokens = {
  light: [{ name: "bg", value: "#fff" }],
  dark: [],
  fonts: { families: [], scale: [] },
  spacing: [],
  radius: [],
  source: "css",
};

describe("AuthoredSnapshotSchema", () => {
  it("accepts a well-formed authored object", () => {
    expect(AuthoredSnapshotSchema.safeParse(AUTHORED).success).toBe(true);
  });

  it("rejects an authored object that re-types verbatim fields (manifest)", () => {
    // The model must NOT author manifest/files/tokens — the schema has no such keys,
    // and a bad enum like an invalid overview.state must fail validation.
    const bad = { ...AUTHORED, overview: { ...AUTHORED.overview, state: "on-fire" } };
    expect(AuthoredSnapshotSchema.safeParse(bad).success).toBe(false);
  });
});

describe("assembleSnapshot", () => {
  const snap = assembleSnapshot(AUTHORED, {
    project: "snapfinder",
    syncedAt: "2026-06-24T09:00:00.000Z",
    repoPresent: true,
    manifest: MANIFEST,
    files: FILES,
    tokens: TOKENS,
  });

  it("merges verbatim manifest/files/tokens untouched", () => {
    expect(snap.manifest).toEqual(MANIFEST);
    expect(snap.files).toEqual(FILES);
    expect(snap.designFeel.tokens).toEqual(TOKENS);
  });

  it("stamps server-set meta and derives meta.state from overview.state", () => {
    expect(snap.meta.project).toBe("snapfinder");
    expect(snap.meta.syncedAt).toBe("2026-06-24T09:00:00.000Z");
    expect(snap.meta.repoPresent).toBe(true);
    expect(snap.meta.state).toBe("watch"); // one source of truth: overview.state
  });

  it("carries the authored prose through", () => {
    expect(snap.overview.headline).toBe("In beta");
    expect(snap.decisions[0].title).toBe("Use Supabase");
    expect(snap.roadmap[0].phase).toBe("Beta");
  });

  it("round-trips through the on-disk ```json body the UI reads", () => {
    const body = ["```json", JSON.stringify(snap, null, 2), "```"].join("\n");
    const parsed = parseSnapshot(body);
    expect(parsed).not.toBeNull();
    expect(parsed?.meta.state).toBe("watch");
    expect(parsed?.designFeel.tokens?.light[0]).toEqual({ name: "bg", value: "#fff" });
  });
});
