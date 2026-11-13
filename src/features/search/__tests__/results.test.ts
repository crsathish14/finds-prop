import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSearchParams } from "../params";
import { toSearchRpcArgs } from "../rpc-args";

const rpc = vi.fn();
const tag = vi.fn();
const life = vi.fn();
const warn = vi.fn();
const error = vi.fn();

vi.mock("next/cache", () => ({ cacheTag: tag, cacheLife: life }));
vi.mock("@/server/supabase/public", () => ({ createPublicSupabase: () => ({ rpc }) }));
vi.mock("@/server/logger", () => ({ logger: { warn, error } }));

const { getSearchResults } = await import("../results");

const home = (overrides: Record<string, unknown> = {}) => ({
  short_id: "k3x9a2bd",
  slug: "3-bhk-apartment-velachery",
  listing_type: "sale",
  property_type: "apartment",
  title: "3 BHK apartment",
  bhk: 3,
  bathrooms: 2,
  area_sqft: 1420,
  price: 12_500_000,
  locality: "Velachery",
  city: "Chennai",
  label: null,
  published_at: "2026-11-01T06:00:00Z",
  cover_path: null,
  cover_alt: null,
  total_count: 48,
  ...overrides,
});

const none = parseSearchParams({});

beforeEach(() => vi.clearAllMocks());

describe("UT-search-rpc-args: a parsed search as search_properties() arguments", () => {
  it("sends only the sort and the length when nothing is chosen", () => {
    expect(toSearchRpcArgs(none)).toEqual({ p_sort: "newest", p_limit: 12 });
  });

  it("maps every filter to its argument", () => {
    const params = parseSearchParams({
      listingType: "sale",
      propertyType: "apartment",
      bhk: "3",
      minPrice: "1000000",
      maxPrice: "15000000",
      locality: "Adyar",
      ["q"]: "park",
      label: "prime",
      sort: "price_asc",
      show: "24",
    });
    expect(toSearchRpcArgs(params)).toEqual({
      p_listing_type: "sale",
      p_property_type: "apartment",
      p_bhk: 3,
      p_min_price: 1_000_000,
      p_max_price: 15_000_000,
      p_locality: "Adyar",
      p_q: "park",
      p_label: "prime",
      p_sort: "price_asc",
      p_limit: 24,
    });
  });

  it("sends the point with the radius, 5 km when none was given, and never the place label", () => {
    const args = toSearchRpcArgs(
      parseSearchParams({ place: "Velachery", lat: "12.98", lng: "80.22" }),
    );
    expect(args).toMatchObject({ p_lat: 12.98, p_lng: 80.22, p_radius_km: 5 });
    expect(args).not.toHaveProperty("place");
    expect(
      toSearchRpcArgs(
        parseSearchParams({ place: "Velachery", lat: "12.98", lng: "80.22", ["r"]: "10" }),
      ),
    ).toMatchObject({ p_radius_km: 10 });
  });

  it("sends no radius without a place", () => {
    expect(toSearchRpcArgs(parseSearchParams({ ["r"]: "10" }))).not.toHaveProperty("p_radius_km");
  });
});

describe("UT-search-results: reading one page of results", () => {
  it("calls the search function and takes the total from total_count", async () => {
    rpc.mockResolvedValue({ data: [home(), home({ short_id: "m4y8b3ce" })], error: null });
    const result = await getSearchResults(none);
    expect(rpc).toHaveBeenCalledWith("search_properties", { p_sort: "newest", p_limit: 12 });
    expect(tag).toHaveBeenCalledWith("home-listings");
    expect(result).toMatchObject({ status: "ok", total: 48 });
    expect(result.status === "ok" && result.homes).toHaveLength(2);
  });

  it("reads total_count when it arrives as text", async () => {
    rpc.mockResolvedValue({ data: [home({ total_count: "7" })], error: null });
    expect(await getSearchResults(none)).toMatchObject({ status: "ok", total: 7 });
  });

  it("gives no homes and a total of 0 when nothing matches", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getSearchResults(none)).toEqual({
      status: "ok",
      homes: [],
      total: 0,
      readAt: expect.any(String),
    });
  });

  it("says when it read the database, as an ISO time (for the assistant's 'as of')", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T10:12:00.000Z"));
    try {
      rpc.mockResolvedValue({ data: [home()], error: null });
      expect(await getSearchResults(none)).toMatchObject({
        status: "ok",
        readAt: "2026-11-13T10:12:00.000Z",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips a row that does not fit and says so without naming it", async () => {
    rpc.mockResolvedValue({ data: [home(), home({ title: "" })], error: null });
    const result = await getSearchResults(none);
    expect(result.status === "ok" && result.homes).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { skipped: 1 });
  });

  it("falls back to the homes held when the first row has no readable total", async () => {
    rpc.mockResolvedValue({ data: [home({ total_count: null })], error: null });
    expect(await getSearchResults(none)).toMatchObject({ status: "ok", total: 1 });
  });

  it("fails without detail and logs only the code when the read fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "search.invalid_bhk" } });
    expect(await getSearchResults(parseSearchParams({ ["q"]: "my secret words" }))).toEqual({
      status: "failed",
    });
    expect(error).toHaveBeenCalledWith(expect.any(String), { errorCode: "22023" });
  });
});
