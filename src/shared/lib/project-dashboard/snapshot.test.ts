import { describe, expect, it } from "vitest";
import { normalizeSnapshot, parseSnapshot } from "./snapshot";

const FULL = {
  meta: {
    project: "snapfinder",
    syncedAt: "2026-06-23T10:00:00.000Z",
    state: "healthy",
    repoPresent: true,
  },
  manifest: [
    { path: "agents/STATUS.md", sha256: "abc", mtime: "2026-06-20T00:00:00.000Z", bytes: 120 },
  ],
  overview: {
    headline: "Snapfinder is in beta",
    state: "watch",
    current: "Polishing onboarding",
    recent: [{ title: "Shipped auth", detail: "OAuth + email" }, "Fixed a crash"],
    next: [{ title: "Launch" }],
    blocked: [],
  },
  whatChanged: [{ version: "1.4", date: "2026-06-20", items: ["a", "b"] }],
  roadmap: [
    { phase: "Beta", status: "active", detail: "now", items: ["x"] },
    { phase: "GA", status: "next" },
  ],
  decisions: [{ title: "Use Supabase", decided: "Supabase", rejected: "Firebase", why: "RLS" }],
  structure: {
    layers: ["React", "Edge functions", "Postgres"],
    folders: [{ name: "src", role: "app" }],
    dataFlow: [{ from: "UI", to: "API", label: "fetch" }],
  },
  designFeel: {
    stack: [{ name: "React", role: "frontend" }],
    brand: { name: "Snapfinder", tagline: "find it fast" },
    tokens: {
      light: [{ name: "bg", value: "#fff" }],
      dark: [],
      fonts: { families: [], scale: [] },
      spacing: [],
      radius: [],
      source: "css",
    },
    direction: "clean",
    principles: ["fast", "simple"],
  },
  files: [{ path: "agents/STATUS.md", title: "Status", category: "status", bytes: 120, lines: 4 }],
};

describe("parseSnapshot", () => {
  it("extracts a fenced ```json block from a snapshot body", () => {
    const body = `---\ntype: project-snapshot\n---\n\n\`\`\`json\n${JSON.stringify(FULL)}\n\`\`\`\n`;
    const snap = parseSnapshot(body);
    expect(snap).not.toBeNull();
    expect(snap?.meta.project).toBe("snapfinder");
    expect(snap?.overview.recent).toHaveLength(2);
    // A bare string in recent[] coerces to a titled item.
    expect(snap?.overview.recent[1]).toEqual({ title: "Fixed a crash" });
    expect(snap?.designFeel.tokens?.source).toBe("css");
  });

  it("falls back to the first balanced object when there is no fence", () => {
    const snap = parseSnapshot(`some preamble ${JSON.stringify(FULL)} trailing`);
    expect(snap?.meta.project).toBe("snapfinder");
  });

  it("returns null for an empty or unparseable body", () => {
    expect(parseSnapshot("")).toBeNull();
    expect(parseSnapshot("just prose, no json")).toBeNull();
    expect(parseSnapshot("```json\n{ not valid }\n```")).toBeNull();
  });
});

describe("normalizeSnapshot", () => {
  it("fills safe defaults for a nearly-empty object", () => {
    const snap = normalizeSnapshot({});
    expect(snap.meta.state).toBe("unknown");
    expect(snap.meta.repoPresent).toBe(true);
    expect(snap.overview.recent).toEqual([]);
    expect(snap.roadmap).toEqual([]);
    expect(snap.designFeel.tokens).toBeNull();
    expect(snap.files).toEqual([]);
  });

  it("clamps invalid enums to their fallbacks", () => {
    const snap = normalizeSnapshot({
      meta: { state: "on-fire" },
      overview: { state: "nope" },
      roadmap: [{ phase: "P", status: "bogus" }],
      files: [{ path: "x", category: "weird" }],
    });
    expect(snap.meta.state).toBe("unknown");
    expect(snap.overview.state).toBe("unknown");
    expect(snap.roadmap[0].status).toBe("later");
    expect(snap.files[0].category).toBe("docs");
  });

  it("drops file content even if the model emits it", () => {
    const snap = normalizeSnapshot({
      files: [{ path: "a", title: "A", category: "status", content: "secret" }],
    });
    expect(snap.files[0]).not.toHaveProperty("content");
  });
});
