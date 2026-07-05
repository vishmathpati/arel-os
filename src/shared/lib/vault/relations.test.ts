import { beforeEach, describe, expect, it, vi } from "vitest";
import { relationLabel, relationOptions } from "./relations";

// ── Mock the data-fetching modules ──────────────────────────────────────────

vi.mock("@/shared/lib/page-data", () => ({
  listPages: vi.fn(),
}));

vi.mock("@/shared/lib/database-data", () => ({
  listRows: vi.fn(),
}));

vi.mock("@/shared/lib/area-data", () => ({
  listAreas: vi.fn(),
}));

import { listAreas } from "@/shared/lib/area-data";
import { listRows } from "@/shared/lib/database-data";
import { listPages } from "@/shared/lib/page-data";

const mockListPages = vi.mocked(listPages);
const mockListRows = vi.mocked(listRows);
const mockListAreas = vi.mocked(listAreas);

const SAMPLE_PAGES = [
  { slug: "meeting-notes", title: "Meeting Notes" },
  { slug: "untitled", title: "" },
];

const SAMPLE_ROWS = [
  { slug: "sbi-card-3390", title: "SBI Card 3390" },
  { slug: "hdfc-debit-card-9505", title: "HDFC Debit 9505" },
];

// Areas are now user-defined (no more fixed 6) — these stand in for a
// template vault's starter areas, each with its resolved identity color.
const SAMPLE_AREAS = [
  { slug: "health", name: "Health", color: "var(--color-area-1)", parent: undefined },
  { slug: "finance", name: "Finance", color: "var(--color-area-6)", parent: undefined },
  { slug: "learning", name: "Learning", color: "var(--color-area-3)", parent: undefined },
  { slug: "work", name: "Work", color: "var(--color-area-2)", parent: undefined },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockListPages.mockResolvedValue(SAMPLE_PAGES as never);
  mockListRows.mockResolvedValue(SAMPLE_ROWS as never);
  mockListAreas.mockResolvedValue(SAMPLE_AREAS as never);
});

// ── relationOptions ──────────────────────────────────────────────────────────

describe("relationOptions", () => {
  it("undefined target → areas + pages combined (legacy)", async () => {
    const opts = await relationOptions(undefined);
    const slugs = opts.map((o) => o.slug);
    // includes every user-defined area
    expect(slugs).toContain("health");
    expect(slugs).toContain("finance");
    // includes pages
    expect(slugs).toContain("meeting-notes");
    expect(slugs).toContain("untitled");
  });

  it("'areas' target → areas only", async () => {
    const opts = await relationOptions("areas");
    expect(opts.map((o) => o.slug)).toEqual(["health", "finance", "learning", "work"]);
    expect(mockListPages).not.toHaveBeenCalled();
  });

  it("'areas' target excludes sub-areas (top-level only)", async () => {
    mockListAreas.mockResolvedValue([
      ...SAMPLE_AREAS,
      { slug: "gym", name: "Gym", color: "var(--color-area-1)", parent: "health" },
    ] as never);
    const opts = await relationOptions("areas");
    expect(opts.map((o) => o.slug)).not.toContain("gym");
  });

  it("'pages' target → pages only", async () => {
    const opts = await relationOptions("pages");
    expect(opts.map((o) => o.slug)).toEqual(["meeting-notes", "untitled"]);
    expect(mockListRows).not.toHaveBeenCalled();
  });

  it("DB slug target → that DB's rows", async () => {
    const opts = await relationOptions("cards");
    expect(mockListRows).toHaveBeenCalledWith("cards");
    expect(opts).toEqual([
      { slug: "sbi-card-3390", label: "SBI Card 3390" },
      { slug: "hdfc-debit-card-9505", label: "HDFC Debit 9505" },
    ]);
  });

  it("falls back to empty array when target DB fetch throws", async () => {
    mockListRows.mockRejectedValue(new Error("not found"));
    const opts = await relationOptions("missing-db");
    expect(opts).toEqual([]);
  });

  it("uses slug as label when page title is empty", async () => {
    const opts = await relationOptions("pages");
    const untitled = opts.find((o) => o.slug === "untitled");
    expect(untitled?.label).toBe("untitled");
  });
});

// ── relationLabel ────────────────────────────────────────────────────────────

describe("relationLabel", () => {
  it("resolves an area slug", async () => {
    const result = await relationLabel(undefined, "[[health]]");
    expect(result.label).toBe("Health");
    expect(result.color).toBeDefined();
  });

  it("resolves a page wikilink (legacy target)", async () => {
    const result = await relationLabel(undefined, "[[meeting-notes]]");
    expect(result.label).toBe("Meeting Notes");
  });

  it("resolves a DB row wikilink", async () => {
    const result = await relationLabel("cards", "[[sbi-card-3390]]");
    expect(result.label).toBe("SBI Card 3390");
  });

  it("falls back to raw slug for a missing row", async () => {
    const result = await relationLabel("cards", "[[unknown-card]]");
    expect(result.label).toBe("unknown-card");
  });

  it("falls back to raw slug when DB fetch throws", async () => {
    mockListRows.mockRejectedValue(new Error("offline"));
    const result = await relationLabel("cards", "[[sbi-card-3390]]");
    expect(result.label).toBe("sbi-card-3390");
  });

  it("returns the input for an empty wikilink", async () => {
    const result = await relationLabel(undefined, "");
    expect(result.label).toBe("");
  });

  it("works for 'areas' target", async () => {
    const result = await relationLabel("areas", "[[finance]]");
    expect(result.label).toBe("Finance");
  });

  it("resolves a user-created area not in a fixed list", async () => {
    mockListAreas.mockResolvedValue([
      { slug: "cooking", name: "Cooking", color: "var(--color-area-5)", parent: undefined },
    ] as never);
    const result = await relationLabel("areas", "[[cooking]]");
    expect(result.label).toBe("Cooking");
    expect(result.color).toBe("var(--color-area-5)");
  });

  it("falls back to slug for unknown area when target is 'areas'", async () => {
    const result = await relationLabel("areas", "[[unknown]]");
    expect(result.label).toBe("unknown");
  });
});

// ── multi-value round-trip (get/set pattern) ─────────────────────────────────

describe("multi-value wikilink normalization", () => {
  it("single string parses as one link", () => {
    const value = "[[sbi-card-3390]]";
    const links = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
    expect(links).toEqual(["[[sbi-card-3390]]"]);
  });

  it("array passes through", () => {
    const value = ["[[sbi-card-3390]]", "[[hdfc-debit-card-9505]]"];
    const links = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
    expect(links).toEqual(["[[sbi-card-3390]]", "[[hdfc-debit-card-9505]]"]);
  });

  it("empty string yields empty array", () => {
    const value = "";
    const links = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
    expect(links).toEqual([]);
  });
});
