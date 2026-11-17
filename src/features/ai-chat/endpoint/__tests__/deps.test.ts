import { beforeEach, describe, expect, it, vi } from "vitest";

// UT-ai-endpoint-deps (ADR-142): `createChatDeps` serves the place-aware search tool and the place rules only when BOTH
// `FLAG_AI_SEARCH` and `FLAG_AI_PLACE_SEARCH` are on. With the place flag off, or with the chat itself off, the tool
// is the one that has always existed and the lookup is never made. Everything the real deps reach is a stand-in.

const envFake = { FLAG_AI_SEARCH: true, FLAG_AI_PLACE_SEARCH: true };
const createRealPlaceLookup = vi.fn();

vi.mock("next/server", () => ({ after: (work: unknown) => void work }));
vi.mock("@/features/site", () => ({
  getFeatureFlags: () => ({ aiSearch: envFake.FLAG_AI_SEARCH }),
}));
vi.mock("@/server/env", () => ({ env: envFake }));
vi.mock("@/server/ai", () => ({ chooseAiProvider: vi.fn() }));
vi.mock("@/server/audit/ai-usage", () => ({ writeAiUsage: vi.fn() }));
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView: vi.fn() }));
vi.mock("@/server/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/server/observability", () => ({ reportError: vi.fn() }));
vi.mock("@/server/rate-limit/rate-limit", () => ({
  enforceAiChatRateLimits: vi.fn(),
  requestVisitorHash: vi.fn(),
}));
vi.mock("../../context/reads", () => ({ realContextReads: {} }));
vi.mock("../../confirm/build-card", () => ({
  buildConfirmCard: vi.fn(),
  realConfirmCardDeps: vi.fn(),
}));
vi.mock("../../real-place-lookup", () => ({ createRealPlaceLookup }));
// The tools themselves are not under test: the registry is a stand-in whose search tool takes a place only when it is
// given a lookup, as the real one does (the registry tests hold the real one to that).
vi.mock("../../tools/registry", async () => {
  const { z: schema } = await import("zod");
  return {
    createAiChatTools: (placeLookup?: unknown) => [
      {
        name: "search_properties",
        input:
          placeLookup === undefined
            ? schema.object({ locality: schema.string().nullable() })
            : schema.object({
                locality: schema.string().nullable(),
                place: schema.string().nullable(),
                radiusKm: schema.int().nullable(),
              }),
      },
    ],
  };
});

const lookup = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  createRealPlaceLookup.mockReturnValue(lookup);
  envFake.FLAG_AI_SEARCH = true;
  envFake.FLAG_AI_PLACE_SEARCH = true;
});

async function searchToolFields(): Promise<{ fields: string[]; placeSearch: boolean | undefined }> {
  const { createChatDeps } = await import("../deps");
  const deps = createChatDeps();
  const search = deps.tools.find((tool) => tool.name === "search_properties");
  const shape = (search?.input as { shape?: Record<string, unknown> } | undefined)?.shape ?? {};
  return { fields: Object.keys(shape), placeSearch: deps.placeSearch };
}

describe("UT-ai-endpoint-deps: which search tool is served", () => {
  it("serves the place-aware tool and the place rules when both flags are on, with the real lookup", async () => {
    const served = await searchToolFields();
    expect(served.fields).toEqual(expect.arrayContaining(["place", "radiusKm"]));
    expect(served.placeSearch).toBe(true);
    expect(createRealPlaceLookup).toHaveBeenCalledTimes(1);
  });

  it("serves the tool that has always existed, and no place rules, when the place flag is off", async () => {
    envFake.FLAG_AI_PLACE_SEARCH = false;
    const served = await searchToolFields();
    expect(served.fields).not.toContain("place");
    expect(served.fields).not.toContain("radiusKm");
    expect(served.placeSearch).toBeUndefined();
    expect(createRealPlaceLookup).not.toHaveBeenCalled();
  });

  it("serves it too when the place flag is on but the chat flag is off", async () => {
    envFake.FLAG_AI_SEARCH = false;
    const served = await searchToolFields();
    expect(served.fields).not.toContain("place");
    expect(served.placeSearch).toBeUndefined();
    expect(createRealPlaceLookup).not.toHaveBeenCalled();
  });

  it("makes a new lookup for each request, so the lookup's memory is one message long", async () => {
    const { createChatDeps } = await import("../deps");
    createChatDeps();
    createChatDeps();
    expect(createRealPlaceLookup).toHaveBeenCalledTimes(2);
  });
});
