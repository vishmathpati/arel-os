import { describe, expect, it } from "vitest";
import { captureStamp, nextInboxId } from "./clipper";

const T = new Date("2026-06-17T15:40:09");

describe("captureStamp", () => {
  it("formats a sortable YYYYMMDD-HHmmss stamp with zero-padding", () => {
    expect(captureStamp(T)).toBe("20260617-154009");
  });
});

describe("nextInboxId", () => {
  it("builds <stamp>-<slug> from the title", () => {
    expect(nextInboxId("A Great Post", new Set(), T)).toBe("20260617-154009-a-great-post");
  });

  it("falls back to 'capture' when the title slugs to empty", () => {
    expect(nextInboxId("!!!", new Set(), T)).toBe("20260617-154009-capture");
  });

  it("suffixes -2, -3 … on collision with taken ids", () => {
    const taken = new Set(["20260617-154009-note", "20260617-154009-note-2"]);
    expect(nextInboxId("note", taken, T)).toBe("20260617-154009-note-3");
  });
});
