import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the fetch-based vault client (browser-only) ────────────────────────

vi.mock("@/shared/lib/vault/client", () => ({
  listDir: vi.fn(),
  readDoc: vi.fn(),
  writeDoc: vi.fn(),
}));

import { listDir, readDoc, writeDoc } from "@/shared/lib/vault/client";
import {
  createArea,
  createSubArea,
  listAreas,
  listSubAreas,
  readArea,
  setAreaArchived,
} from "./area-data";

const mockListDir = vi.mocked(listDir);
const mockReadDoc = vi.mocked(readDoc);
const mockWriteDoc = vi.mocked(writeDoc);

/** Build a fake `_index.md` VaultDoc for an area. */
function areaDoc(overrides: Record<string, unknown> = {}) {
  const slug = (overrides.area as string | undefined)?.replace(/[[\]]/g, "") ?? "health";
  return {
    path: `areas/${slug}/_index.md`,
    frontmatter: {
      type: "area",
      area: `[[${slug}]]`,
      name: "Health",
      order: 1,
      archived: false,
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-01T00:00:00.000Z",
      ...overrides,
    },
    body: "",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAreas", () => {
  it("returns an empty array for a vault with zero areas (no crash)", async () => {
    mockListDir.mockResolvedValue({ dir: "areas", entries: [] });
    expect(await listAreas()).toEqual([]);
  });

  it("lists every area dir's _index.md, sorted by order", async () => {
    mockListDir.mockResolvedValue({
      dir: "areas",
      entries: [
        { path: "areas/work", type: "dir" },
        { path: "areas/health", type: "dir" },
      ],
    } as never);
    mockReadDoc.mockImplementation(async (path: string) => {
      if (path === "areas/work/_index.md") {
        return areaDoc({ area: "[[work]]", name: "Work", order: 2 }) as never;
      }
      return areaDoc({ area: "[[health]]", name: "Health", order: 1 }) as never;
    });

    const areas = await listAreas();
    expect(areas.map((a) => a.slug)).toEqual(["health", "work"]);
  });

  it("skips non-area docs and dirs that fail to read", async () => {
    mockListDir.mockResolvedValue({
      dir: "areas",
      entries: [
        { path: "areas/health", type: "dir" },
        { path: "areas/broken", type: "dir" },
      ],
    } as never);
    mockReadDoc.mockImplementation(async (path: string) => {
      if (path === "areas/broken/_index.md") throw new Error("missing");
      return areaDoc({ area: "[[health]]" }) as never;
    });

    const areas = await listAreas();
    expect(areas.map((a) => a.slug)).toEqual(["health"]);
  });

  it("resolves color/icon from frontmatter when present", async () => {
    mockListDir.mockResolvedValue({
      dir: "areas",
      entries: [{ path: "areas/health", type: "dir" }],
    } as never);
    mockReadDoc.mockResolvedValue(
      areaDoc({ area: "[[health]]", color: "var(--color-area-3)", icon: "Compass" }) as never,
    );

    const [area] = await listAreas();
    expect(area?.color).toBe("var(--color-area-3)");
  });

  it("falls back to the order-based palette when color/icon are absent", async () => {
    mockListDir.mockResolvedValue({
      dir: "areas",
      entries: [{ path: "areas/health", type: "dir" }],
    } as never);
    mockReadDoc.mockResolvedValue(areaDoc({ area: "[[health]]", order: 2 }) as never);

    const [area] = await listAreas();
    // order 2 → second palette slot (var(--color-area-2)) per areas.ts::paletteForOrder
    expect(area?.color).toBe("var(--color-area-2)");
  });
});

describe("listSubAreas", () => {
  it("returns only areas whose parent matches", async () => {
    mockListDir.mockResolvedValue({
      dir: "areas",
      entries: [
        { path: "areas/health", type: "dir" },
        { path: "areas/gym", type: "dir" },
      ],
    } as never);
    mockReadDoc.mockImplementation(async (path: string) => {
      if (path === "areas/gym/_index.md") {
        return areaDoc({ area: "[[gym]]", parent: "[[health]]", order: 1 }) as never;
      }
      return areaDoc({ area: "[[health]]" }) as never;
    });

    const subs = await listSubAreas("health");
    expect(subs.map((s) => s.slug)).toEqual(["gym"]);
  });
});

describe("createArea", () => {
  it("assigns order 1 and the first palette slot for the first area", async () => {
    mockListDir.mockResolvedValue({ dir: "areas", entries: [] });
    mockWriteDoc.mockImplementation(async (path, frontmatter) => ({
      path,
      frontmatter: frontmatter as never,
    }));

    const area = await createArea({ name: "Health" });
    expect(area.slug).toBe("health");
    expect(area.order).toBe(1);
    expect(mockWriteDoc).toHaveBeenCalledWith(
      "areas/health/_index.md",
      expect.objectContaining({ color: "var(--color-area-1)", icon: "HeartPulse", order: 1 }),
      "",
    );
  });

  it("assigns the next order after existing top-level areas, skipping sub-areas", async () => {
    mockListDir.mockResolvedValue({
      dir: "areas",
      entries: [
        { path: "areas/health", type: "dir" },
        { path: "areas/gym", type: "dir" },
      ],
    } as never);
    mockReadDoc.mockImplementation(async (path: string) => {
      if (path === "areas/gym/_index.md") {
        return areaDoc({ area: "[[gym]]", parent: "[[health]]", order: 5 }) as never;
      }
      return areaDoc({ area: "[[health]]", order: 1 }) as never;
    });
    mockWriteDoc.mockImplementation(async (path, frontmatter) => ({
      path,
      frontmatter: frontmatter as never,
    }));

    const area = await createArea({ name: "Finance" });
    // Next top-level order is 2 (health=1), NOT 6 (which would double-count the sub-area).
    expect(area.order).toBe(2);
  });

  it("de-duplicates the slug when the name collides", async () => {
    mockListDir.mockResolvedValue({
      dir: "areas",
      entries: [{ path: "areas/health", type: "dir" }],
    } as never);
    mockReadDoc.mockResolvedValue(areaDoc({ area: "[[health]]" }) as never);
    mockWriteDoc.mockImplementation(async (path, frontmatter) => ({
      path,
      frontmatter: frontmatter as never,
    }));

    const area = await createArea({ name: "Health" });
    expect(area.slug).toBe("health-2");
  });
});

describe("createSubArea", () => {
  it("throws when the parent is itself a sub-area (2-level max)", async () => {
    mockReadDoc.mockResolvedValue(areaDoc({ area: "[[gym]]", parent: "[[health]]" }) as never);
    await expect(createSubArea("gym", { name: "Cardio" })).rejects.toThrow(/2 levels/);
  });

  it("throws when the parent doesn't exist", async () => {
    mockReadDoc.mockRejectedValue(new Error("not found"));
    await expect(createSubArea("ghost", { name: "X" })).rejects.toThrow(/not found/);
  });
});

describe("readArea", () => {
  it("returns null for a missing area", async () => {
    mockReadDoc.mockRejectedValue(new Error("not found"));
    expect(await readArea("ghost")).toBeNull();
  });

  it("returns null when the doc exists but isn't an area", async () => {
    mockReadDoc.mockResolvedValue({
      path: "tasks/x.md",
      frontmatter: { type: "task" },
      body: "",
    } as never);
    expect(await readArea("x")).toBeNull();
  });
});

describe("setAreaArchived", () => {
  it("patches the archived flag and preserves other frontmatter", async () => {
    mockReadDoc.mockResolvedValue(areaDoc({ area: "[[health]]", archived: false }) as never);
    mockWriteDoc.mockImplementation(async (path, frontmatter) => ({
      path,
      frontmatter: frontmatter as never,
    }));

    const area = areaDoc({ area: "[[health]]" });
    const result = await setAreaArchived(
      {
        slug: "health",
        name: "Health",
        description: "",
        color: "var(--color-area-1)",
        icon: (() => null) as never,
        archived: false,
        order: 1,
        path: area.path,
        body: "",
      },
      true,
    );
    expect(result.archived).toBe(true);
    expect(mockWriteDoc).toHaveBeenCalledWith(
      "areas/health/_index.md",
      expect.objectContaining({ archived: true, name: "Health" }),
      "",
    );
  });
});
