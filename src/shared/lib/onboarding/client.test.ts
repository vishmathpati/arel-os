import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock the fetch-based vault client (browser-only) ────────────────────────

vi.mock("@/shared/lib/vault/client", () => ({
  readDoc: vi.fn(),
  writeDoc: vi.fn(),
}));

import { readDoc, writeDoc } from "@/shared/lib/vault/client";
import {
  type OnboardingState,
  STEP_ORDER,
  isPlaceholderStep,
  markStepComplete,
  nextStepAfter,
  readOnboarding,
  stepIndex,
  writeOnboarding,
} from "./client";

const mockReadDoc = vi.mocked(readDoc);
const mockWriteDoc = vi.mocked(writeDoc);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("readOnboarding", () => {
  it("returns a seeded not-started state when system/onboarding.md is absent (no write)", async () => {
    mockReadDoc.mockRejectedValue(new Error("404 not found"));

    const state = await readOnboarding();

    expect(state.status).toBe("not-started");
    expect(state.currentStep).toBe("welcome");
    expect(state.completedSteps).toEqual([]);
    expect(state.gates).toEqual({
      finance: "pending",
      recipes: "pending",
      ai: "pending",
      helpers: "pending",
    });
    expect(mockWriteDoc).not.toHaveBeenCalled();
  });

  it("parses a well-formed onboarding doc", async () => {
    mockReadDoc.mockResolvedValue({
      path: "system/onboarding.md",
      frontmatter: {
        type: "system",
        status: "in-progress",
        current_step: "quest",
        completed_steps: ["welcome", "areas"],
        skipped_steps: [],
        gates: { finance: "no", recipes: "pending", ai: "pending", helpers: "pending" },
        artifacts: { questTitle: "Ship v1" },
        started: "2026-07-05T00:00:00.000Z",
        updated: "2026-07-05T00:00:00.000Z",
      },
      body: "",
    } as never);

    const state = await readOnboarding();
    expect(state.status).toBe("in-progress");
    expect(state.currentStep).toBe("quest");
    expect(state.completedSteps).toEqual(["welcome", "areas"]);
    expect(state.gates.finance).toBe("no");
    expect(state.artifacts.questTitle).toBe("Ship v1");
  });

  it("falls back to defaults for malformed fields instead of throwing", async () => {
    mockReadDoc.mockResolvedValue({
      path: "system/onboarding.md",
      frontmatter: {
        type: "system",
        status: "not-a-real-status",
        current_step: "not-a-real-step",
        completed_steps: "not-an-array",
        gates: "not-an-object",
        artifacts: null,
      },
      body: "",
    } as never);

    const state = await readOnboarding();
    expect(state.status).toBe("not-started");
    expect(state.currentStep).toBe("welcome");
    expect(state.completedSteps).toEqual([]);
    expect(state.gates.finance).toBe("pending");
    expect(state.artifacts).toEqual({});
  });

  it("filters unknown step ids out of completed_steps", async () => {
    mockReadDoc.mockResolvedValue({
      path: "system/onboarding.md",
      frontmatter: {
        type: "system",
        status: "in-progress",
        current_step: "welcome",
        completed_steps: ["welcome", "ghost-step", "areas"],
        gates: {},
        artifacts: {},
      },
      body: "",
    } as never);

    const state = await readOnboarding();
    expect(state.completedSteps).toEqual(["welcome", "areas"]);
  });
});

describe("writeOnboarding", () => {
  it("merges a partial patch onto the current state and persists to system/onboarding.md", async () => {
    mockReadDoc.mockRejectedValue(new Error("404"));
    mockWriteDoc.mockImplementation(async (path, frontmatter) => ({
      path,
      frontmatter: frontmatter as never,
    }));

    const result = await writeOnboarding({ status: "in-progress", currentStep: "areas" });

    expect(mockWriteDoc).toHaveBeenCalledWith(
      "system/onboarding.md",
      expect.objectContaining({ status: "in-progress", current_step: "areas" }),
      expect.any(String),
    );
    expect(result.status).toBe("in-progress");
    expect(result.currentStep).toBe("areas");
  });

  it("shallow-merges gates so unrelated gate answers survive", async () => {
    mockReadDoc.mockResolvedValue({
      path: "system/onboarding.md",
      frontmatter: {
        type: "system",
        status: "in-progress",
        current_step: "gate-finance",
        completed_steps: [],
        gates: { finance: "pending", recipes: "yes", ai: "pending", helpers: "pending" },
        artifacts: {},
      },
      body: "",
    } as never);
    mockWriteDoc.mockImplementation(async (path, frontmatter) => ({
      path,
      frontmatter: frontmatter as never,
    }));

    const result = await writeOnboarding({ gates: { finance: "no" } as never });
    expect(result.gates.finance).toBe("no");
    expect(result.gates.recipes).toBe("yes"); // untouched
  });

  it("merges artifacts rather than replacing the whole object", async () => {
    mockReadDoc.mockResolvedValue({
      path: "system/onboarding.md",
      frontmatter: {
        type: "system",
        status: "in-progress",
        current_step: "project",
        completed_steps: [],
        gates: {},
        artifacts: { questTitle: "Ship v1" },
      },
      body: "",
    } as never);
    mockWriteDoc.mockImplementation(async (path, frontmatter) => ({
      path,
      frontmatter: frontmatter as never,
    }));

    const result = await writeOnboarding({ artifacts: { projectTitle: "Design the API" } });
    expect(result.artifacts.questTitle).toBe("Ship v1");
    expect(result.artifacts.projectTitle).toBe("Design the API");
  });
});

describe("markStepComplete", () => {
  const base: OnboardingState = {
    status: "in-progress",
    currentStep: "quest",
    completedSteps: ["welcome", "areas"],
    skippedSteps: [],
    gates: { finance: "pending", recipes: "pending", ai: "pending", helpers: "pending" },
    artifacts: {},
  };

  it("appends the step and advances currentStep", () => {
    const patch = markStepComplete(base, "quest", "project");
    expect(patch.completedSteps).toEqual(["welcome", "areas", "quest"]);
    expect(patch.currentStep).toBe("project");
    expect(patch.status).toBe("in-progress");
  });

  it("is idempotent — completing an already-completed step doesn't duplicate it", () => {
    const patch = markStepComplete(base, "areas", "quest");
    expect(patch.completedSteps).toEqual(["welcome", "areas"]);
  });

  it("records a skip flag without touching completedSteps shape", () => {
    const patch = markStepComplete(base, "quest", "project", { skipped: true });
    expect(patch.skippedSteps).toEqual(["quest"]);
    expect(patch.completedSteps).toEqual(["welcome", "areas", "quest"]);
  });

  it("merges artifacts collected on the step", () => {
    const patch = markStepComplete(base, "quest", "project", {
      artifacts: { questTitle: "Ship v1", questSlug: "ship-v1" },
    });
    expect(patch.artifacts).toEqual({ questTitle: "Ship v1", questSlug: "ship-v1" });
  });
});

describe("step order helpers", () => {
  it("STEP_ORDER starts at welcome and ends at done", () => {
    expect(STEP_ORDER[0]).toBe("welcome");
    expect(STEP_ORDER[STEP_ORDER.length - 1]).toBe("done");
  });

  it("nextStepAfter walks the canonical order and terminates at done", () => {
    expect(nextStepAfter("welcome")).toBe("areas");
    expect(nextStepAfter("manifesto")).toBe("gate-finance");
    expect(nextStepAfter("done")).toBe("done");
  });

  it("stepIndex resolves a known step and -1 for an unknown one", () => {
    expect(stepIndex("welcome")).toBe(0);
    expect(stepIndex("nope" as never)).toBe(-1);
  });

  it("has no placeholder steps as of Phase 2 — every step has a real screen", () => {
    expect(isPlaceholderStep("gate-finance")).toBe(false);
    expect(isPlaceholderStep("gate-recipes")).toBe(false);
    expect(isPlaceholderStep("gate-ai")).toBe(false);
    expect(isPlaceholderStep("helpers")).toBe(false);
    expect(isPlaceholderStep("quest")).toBe(false);
    expect(isPlaceholderStep("done")).toBe(false);
  });
});
