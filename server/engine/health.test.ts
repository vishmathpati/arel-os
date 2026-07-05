import { APICallError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `validateGatewayKey` (server/engine/health.ts) must classify errors, not just
// pass/fail on whether the gateway call throws. Mock `generateText` (the real
// probe it now runs) and `readEngineConfig` (model resolution) so we can drive
// each of the three response states without a live key or network access.

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, generateText: vi.fn() };
});

vi.mock("./config.ts", () => ({
  readEngineConfig: vi.fn().mockResolvedValue({
    defaultModel: "deepseek/deepseek-v4-flash",
    fallbackModel: "openai/gpt-5.4-mini",
    models: [],
    recipes: {},
  }),
}));

// Health probes other than validateGatewayKey touch the vault/recipe loader —
// not exercised by these tests, but the module import graph still needs them.
vi.mock("./recipe.ts", () => ({ loadRecipe: vi.fn() }));
vi.mock("../io.ts", () => ({ listVaultDir: vi.fn() }));

import { generateText } from "ai";
import { isGwsOnPath, validateGatewayKey } from "./health.ts";

const mockGenerateText = vi.mocked(generateText);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateGatewayKey", () => {
  it("returns status 'ok' when the probe completion succeeds", async () => {
    mockGenerateText.mockResolvedValue({ text: "hi" } as never);
    const result = await validateGatewayKey();
    expect(result.status).toBe("ok");
    expect(result.detail).toMatch(/works/i);
  });

  it("classifies a 401 APICallError as 'invalid-key'", async () => {
    mockGenerateText.mockRejectedValue(
      new APICallError({
        message: "Unauthorized",
        url: "https://gateway.example/v1",
        requestBodyValues: {},
        statusCode: 401,
      }),
    );
    const result = await validateGatewayKey();
    expect(result.status).toBe("invalid-key");
  });

  it("classifies the real gateway auth-failure shape as 'invalid-key' (verified live with a fake key)", async () => {
    // `ai`'s gateway wrapper (wrapGatewayError) rethrows a fake-key 401 as a bare
    // Error named "GatewayAuthenticationError" with NO statusCode — confirmed by
    // booting a throwaway server and POSTing a fake key. This is the shape that
    // actually reaches validateGatewayKey in production, not a synthetic APICallError.
    const err = Object.assign(new Error("Unauthenticated request to AI Gateway."), {
      name: "GatewayAuthenticationError",
    });
    mockGenerateText.mockRejectedValue(err);
    const result = await validateGatewayKey();
    expect(result.status).toBe("invalid-key");
  });

  it("classifies the production gateway auth-failure shape ('GatewayError' + unauthenticated message) as 'invalid-key'", async () => {
    const err = Object.assign(
      new Error("Unauthenticated. Configure AI_GATEWAY_API_KEY or use a provider module."),
      { name: "GatewayError" },
    );
    mockGenerateText.mockRejectedValue(err);
    const result = await validateGatewayKey();
    expect(result.status).toBe("invalid-key");
  });

  it("classifies a 403 APICallError as 'invalid-key'", async () => {
    mockGenerateText.mockRejectedValue(
      new APICallError({
        message: "Forbidden",
        url: "https://gateway.example/v1",
        requestBodyValues: {},
        statusCode: 403,
      }),
    );
    const result = await validateGatewayKey();
    expect(result.status).toBe("invalid-key");
  });

  it("classifies a 500 APICallError as 'unreachable', not 'invalid-key'", async () => {
    mockGenerateText.mockRejectedValue(
      new APICallError({
        message: "Internal Server Error",
        url: "https://gateway.example/v1",
        requestBodyValues: {},
        statusCode: 500,
      }),
    );
    const result = await validateGatewayKey();
    expect(result.status).toBe("unreachable");
  });

  it("classifies a network error (no statusCode) as 'unreachable'", async () => {
    mockGenerateText.mockRejectedValue(new TypeError("fetch failed"));
    const result = await validateGatewayKey();
    expect(result.status).toBe("unreachable");
  });

  it("classifies a missing-API-key load error as 'invalid-key'", async () => {
    const err = new Error("No API key found");
    err.name = "AI_LoadAPIKeyError";
    mockGenerateText.mockRejectedValue(err);
    const result = await validateGatewayKey();
    expect(result.status).toBe("invalid-key");
  });

  // Regression test for the live bug: a fully valid key was reported as
  // "unreachable" because the old probe asked for `maxOutputTokens: 8`, which
  // the gateway rejects with a 400 "below minimum value" error before the key
  // is ever checked. Confirmed live against the real gateway with a real key.
  it("classifies the real gateway 400 'max_output_tokens below minimum' error as 'model-error', not 'unreachable'", async () => {
    const err = Object.assign(
      new Error(
        "Invalid 'max_output_tokens': integer below minimum value. Expected a value >= 16, but got 8 instead.",
      ),
      { name: "GatewayInternalServerError", statusCode: 400 },
    );
    mockGenerateText.mockRejectedValue(err);
    const result = await validateGatewayKey();
    expect(result.status).toBe("model-error");
  });

  it("classifies a GatewayModelNotFoundError as 'model-error'", async () => {
    const err = Object.assign(new Error("Model not found: bogus/model"), {
      name: "GatewayModelNotFoundError",
    });
    mockGenerateText.mockRejectedValue(err);
    const result = await validateGatewayKey();
    expect(result.status).toBe("model-error");
  });

  it("classifies a 402 APICallError as 'no-credit'", async () => {
    mockGenerateText.mockRejectedValue(
      new APICallError({
        message: "Payment required",
        url: "https://gateway.example/v1",
        requestBodyValues: {},
        statusCode: 402,
      }),
    );
    const result = await validateGatewayKey();
    expect(result.status).toBe("no-credit");
  });

  it("classifies a 429 APICallError as 'rate-limited'", async () => {
    mockGenerateText.mockRejectedValue(
      new APICallError({
        message: "Too many requests",
        url: "https://gateway.example/v1",
        requestBodyValues: {},
        statusCode: 429,
      }),
    );
    const result = await validateGatewayKey();
    expect(result.status).toBe("rate-limited");
  });

  it("classifies a GatewayRateLimitError (no statusCode) as 'rate-limited'", async () => {
    const err = Object.assign(new Error("Rate limit exceeded"), { name: "GatewayRateLimitError" });
    mockGenerateText.mockRejectedValue(err);
    const result = await validateGatewayKey();
    expect(result.status).toBe("rate-limited");
  });

  it("still classifies an unrelated 400 with no model/rate/credit language as 'unreachable'", async () => {
    const err = Object.assign(new Error("Something went wrong upstream"), {
      name: "GatewayInternalServerError",
      statusCode: 400,
    });
    mockGenerateText.mockRejectedValue(err);
    const result = await validateGatewayKey();
    expect(result.status).toBe("unreachable");
  });
});

// `isGwsOnPath` backs the finance-sync install-guide panel: it must tell
// "not installed" apart from any other failure so the UI only shows the
// install guide when that's genuinely the problem. `Bun.spawn` is a global
// this suite runs without (vitest's worker environment has no `Bun` even
// under `bun run`), so `vi.stubGlobal` stands in a fake `Bun` for these tests
// only — confirmed live (see server/engine/health.ts) that the real
// Bun.spawn throws synchronously with "Executable not found in $PATH" when a
// binary isn't installed, which the third case reproduces.
describe("isGwsOnPath", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns true when `gws --version` exits 0", async () => {
    vi.stubGlobal("Bun", { spawn: () => ({ exited: Promise.resolve(0) }) });
    expect(await isGwsOnPath()).toBe(true);
  });

  it("returns false when `gws --version` exits non-zero", async () => {
    vi.stubGlobal("Bun", { spawn: () => ({ exited: Promise.resolve(1) }) });
    expect(await isGwsOnPath()).toBe(false);
  });

  it("returns false when Bun.spawn throws (binary not on PATH)", async () => {
    vi.stubGlobal("Bun", {
      spawn: () => {
        throw new Error('Executable not found in $PATH: "gws"');
      },
    });
    expect(await isGwsOnPath()).toBe(false);
  });
});
