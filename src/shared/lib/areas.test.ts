import { describe, expect, it } from "vitest";
import { PALETTE, areaSlug, areaWikilink, iconByName, paletteForOrder } from "./areas";

describe("paletteForOrder", () => {
  it("assigns the first palette slot to order 1", () => {
    expect(paletteForOrder(1)).toBe(PALETTE[0]);
  });

  it("assigns each of the first 6 orders a distinct slot", () => {
    const slots = [1, 2, 3, 4, 5, 6].map(paletteForOrder);
    expect(new Set(slots).size).toBe(6);
  });

  it("cycles back to the first slot for the 7th area", () => {
    expect(paletteForOrder(7)).toBe(PALETTE[0]);
  });

  it("cycles predictably for a 13th area (two full loops in)", () => {
    expect(paletteForOrder(13)).toBe(PALETTE[0]);
  });

  it("clamps order 0 or negative to the first slot", () => {
    expect(paletteForOrder(0)).toBe(PALETTE[0]);
    expect(paletteForOrder(-5)).toBe(PALETTE[0]);
  });
});

describe("iconByName", () => {
  it("resolves a known palette icon name", () => {
    expect(iconByName("HeartPulse")).toBe(PALETTE[0]?.icon);
  });

  it("falls back to the generic icon for an unknown name", () => {
    expect(iconByName("NotARealIcon")).toBeTruthy();
    expect(iconByName("NotARealIcon")).not.toBe(PALETTE[0]?.icon);
  });

  it("falls back to the generic icon when name is undefined", () => {
    expect(iconByName(undefined)).toBeTruthy();
  });
});

describe("areaSlug", () => {
  it("unwraps a wikilink to its bare slug", () => {
    expect(areaSlug("[[health]]")).toBe("health");
  });

  it("unwraps a piped wikilink to its target", () => {
    expect(areaSlug("[[health|Health]]")).toBe("health");
  });

  it("returns null for undefined", () => {
    expect(areaSlug(undefined)).toBeNull();
  });
});

describe("areaWikilink", () => {
  it("wraps a slug into wikilink form", () => {
    expect(areaWikilink("health")).toBe("[[health]]");
  });
});
