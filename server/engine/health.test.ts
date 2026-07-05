import { APICallError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { validateGatewayKey } from "./health.ts";

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
});
