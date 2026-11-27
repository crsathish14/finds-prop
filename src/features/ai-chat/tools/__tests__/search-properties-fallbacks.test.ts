import { beforeEach, describe, expect, it, vi } from "vitest";
import { listingRow, READ_AT, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-fallbacks (ADR-216): when a home search finds nothing, the same call widens around the locality's centre
// (signed-in only), or gives the nearest other bedroom count, or the price range of our homes there. The reads are
// stand-ins; the homes are made up.

const getSearchResults = vi.fn();
const getLocalityCentre = vi.fn();

vi.mock("../../ranking/reads.server", () => ({
  getLocalityCentre,
  getHomeExtras: vi.fn(async () => new Map()),
  getProjectExtras: vi.fn(),
  getPromotionLists: vi.fn(),
}));
vi.mock("@/server/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("../listing-projects", () => ({ projectsForHomeSearch: vi.fn(async () => null) }));
vi.mock("../search-projects", () => ({ toProjectSummary: vi.fn() }));
vi.mock("@/features/search", async () => {
  const { DEFAULT_RADIUS_KM, DEFAULT_SORT, DEFAULT_VIEW } =
    await import("@/features/search/schemas");
  const { NEARBY_RADIUS_KM, nearbyHomesToShow, nearbySearchParams, wantsNearby } =
    await import("@/features/search/nearby");
  return {
    getSearchResults,
    DEFAULT_RADIUS_KM,
    DEFAULT_SORT,
    DEFAULT_VIEW,
    NEARBY_RADIUS_KM,
    nearbyHomesToShow,
    nearbySearchParams,
    wantsNearby,
  };
});

const { runTool } = await import("../run");
const { searchPropertiesTool } = await import("../search-properties");

const NOTHING = {
  listingType: null,
  propertyType: null,
  bhk: null,
  minPrice: null,
  maxPrice: null,
  city: null,
  locality: null,
  keyword: null,
  label: null,
  preferLocalities: null,
  preferAmenities: null,
  preferFurnishing: null,
  sort: null,
  page: null,
};

const found = (homes: ReturnType<typeof listingRow>[], total = homes.length) => ({
  status: "ok",
  homes,
  total,
  readAt: READ_AT,
});
const none = found([]);

type Params = Record<string, unknown>;

const search = (input: Record<string, unknown>, context = TOOL_CONTEXT) =>
  runTool([searchPropertiesTool], { name: "search_properties", input }, context);

async function output(input: Record<string, unknown>, context = TOOL_CONTEXT) {
  const result = await search(input, context);
  if (result.status !== "ok") throw new Error(`the search failed: ${JSON.stringify(result)}`);
  return result.output as {
    total: number;
    homes: { homeId: string }[];
    widened: { radiusKm: number } | null;
    alternative: { bhk: number; total: number; homes: { homeId: string }[] } | null;
    priceRange: { lowestText: string; highestText: string; homesThere: number } | null;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getLocalityCentre.mockResolvedValue({ lat: 12.98, lng: 80.22 });
  getSearchResults.mockResolvedValue(none);
});

describe("UT-ai-tool-fallbacks: widening around the locality (ADR-216)", () => {
  it("tries 5, 10 and 15 km around the centre in one call and answers with the smallest circle that holds homes", async () => {
    getSearchResults.mockImplementation(async (params: Params) => {
      if (params["lat"] === undefined) return none;
      return params["radiusKm"] === 5
        ? none
        : found([listingRow({ short_id: `near${String(params["radiusKm"])}aa` })]);
    });
    const result = await output({ ...NOTHING, locality: "Velachery" });
    expect(result.widened).toEqual({ radiusKm: 10 });
    expect(result.homes.map((home) => home.homeId)).toEqual(["near10aa"]);
    expect(result.total).toBe(1);
    const circles = getSearchResults.mock.calls
      .map(([params]) => params as Params)
      .filter((params) => params["lat"] !== undefined);
    expect(circles.map((params) => params["radiusKm"]).sort()).toEqual([10, 15, 5]);
    // The locality text is replaced by the circle, and nothing paid looks the place up.
    for (const params of circles) {
      expect(params["locality"]).toBeUndefined();
      expect(params).toMatchObject({ lat: 12.98, lng: 80.22 });
    }
  });

  it("never widens for a guest, and never without a locality or a centre", async () => {
    expect(
      (await output({ ...NOTHING, locality: "Velachery" }, { ...TOOL_CONTEXT, signedIn: false }))
        .widened,
    ).toBeNull();
    expect(getLocalityCentre).not.toHaveBeenCalled();
    expect((await output({ ...NOTHING, listingType: "sale" })).widened).toBeNull();
    getLocalityCentre.mockResolvedValue(null);
    expect((await output({ ...NOTHING, locality: "Nowhere" })).widened).toBeNull();
  });

  it("reads nothing more when the search found homes", async () => {
    getSearchResults.mockResolvedValue(found([listingRow()]));
    const result = await output({ ...NOTHING, locality: "Velachery", bhk: 3 });
    expect(result).toMatchObject({ widened: null, alternative: null, priceRange: null });
    expect(getLocalityCentre).not.toHaveBeenCalled();
    expect(getSearchResults).toHaveBeenCalledTimes(1);
  });
});

describe("UT-ai-tool-fallbacks: the nearest alternative and the price range (ADR-216)", () => {
  it("gives homes with one bedroom fewer when the count asked for has none, apart from the matches", async () => {
    getLocalityCentre.mockResolvedValue(null);
    getSearchResults.mockImplementation(async (params: Params) =>
      params["bhk"] === 2
        ? found([listingRow({ short_id: "twobhk01" }), listingRow({ short_id: "twobhk02" })])
        : none,
    );
    const result = await output({ ...NOTHING, locality: "Velachery", bhk: 3, maxPrice: 9_000_000 });
    expect(result.homes).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.alternative).toMatchObject({ bhk: 2, total: 2 });
    expect(result.alternative?.homes.map((home) => home.homeId)).toEqual(["twobhk01", "twobhk02"]);
  });

  it("gives the lowest and highest price of our homes there, when at least five are there", async () => {
    getLocalityCentre.mockResolvedValue(null);
    getSearchResults.mockImplementation(async (params: Params) => {
      if (params["maxPrice"] !== undefined) return none;
      if (params["sort"] === "price_asc") return found([listingRow({ price: 9_500_000 })], 6);
      if (params["sort"] === "price_desc") return found([listingRow({ price: 25_000_000 })], 6);
      return none;
    });
    const result = await output({
      ...NOTHING,
      listingType: "sale",
      locality: "Adyar",
      maxPrice: 9_000_000,
    });
    expect(result.priceRange).toEqual({
      lowestText: "₹95 L",
      highestText: "₹2.5 Cr",
      homesThere: 6,
    });
  });

  it("gives no price range for fewer than five homes, or when sale and rent are mixed", async () => {
    getLocalityCentre.mockResolvedValue(null);
    getSearchResults.mockImplementation(async (params: Params) =>
      params["maxPrice"] === undefined ? found([listingRow({ price: 9_500_000 })], 4) : none,
    );
    expect(
      (await output({ ...NOTHING, listingType: "sale", maxPrice: 9_000_000 })).priceRange,
    ).toBeNull();
    getSearchResults.mockImplementation(async (params: Params) =>
      params["maxPrice"] === undefined ? found([listingRow({ price: 9_500_000 })], 9) : none,
    );
    expect((await output({ ...NOTHING, maxPrice: 9_000_000 })).priceRange).toBeNull();
  });

  it("still answers when a fallback read fails", async () => {
    getSearchResults.mockImplementation(async (params: Params) =>
      params["lat"] !== undefined || params["bhk"] === 2 ? Promise.reject(new Error("down")) : none,
    );
    const result = await output({ ...NOTHING, locality: "Velachery", bhk: 3 });
    expect(result).toMatchObject({ total: 0, widened: null, alternative: null });
  });
});
