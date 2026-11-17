import { describe, expect, it } from "vitest";
import type { ListingRow } from "../listing-row";
import {
  NEARBY_LIMIT,
  NEARBY_RADIUS_KM,
  NEARBY_READ_SHOW,
  NEARBY_THRESHOLD,
  nearbyHomesToShow,
  nearbySearchParams,
  wantsNearby,
} from "../nearby";
import { buildSearchHref, parseSearchParams } from "../params";
import { toSearchRpcArgs } from "../rpc-args";

const PLACE = { place: "Velachery", lat: "12.98", lng: "80.22" };

function home(shortId: string, distance: number | null = null): ListingRow {
  return {
    short_id: shortId,
    slug: `home-${shortId}`,
    listing_type: "sale",
    property_type: "apartment",
    title: `Home ${shortId}`,
    bhk: 2,
    bathrooms: 2,
    area_sqft: 900,
    price: 5_000_000,
    locality: "Velachery",
    city: "Chennai",
    label: null,
    published_at: null,
    cover_path: null,
    cover_alt: null,
    distance_km: distance,
    ageDays: null,
  };
}

const homes = (from: number, count: number) =>
  Array.from({ length: count }, (_value, index) => home(`h${from + index}`, 1 + index));

const ids = (rows: readonly ListingRow[]) => rows.map((row) => row.short_id);

describe("UT-nearby: when the page looks further out (FR-GEO-03, ADR-137)", () => {
  it("is 6 homes, 15 km and 12 homes", () => {
    expect([NEARBY_THRESHOLD, NEARBY_RADIUS_KM, NEARBY_LIMIT]).toEqual([6, 15, 12]);
  });

  it("looks further out for a place search with fewer than six homes", () => {
    const params = parseSearchParams(PLACE);
    expect(wantsNearby(params, 0)).toBe(true);
    expect(wantsNearby(params, 5)).toBe(true);
    expect(wantsNearby(params, 6)).toBe(false);
    expect(wantsNearby(params, 48)).toBe(false);
  });

  it("takes the threshold as a parameter", () => {
    expect(wantsNearby(parseSearchParams(PLACE), 9, 10)).toBe(true);
  });

  it("does not look further out without a place, or when the circle is already 15 km", () => {
    expect(wantsNearby(parseSearchParams({ locality: "Adyar" }), 0)).toBe(false);
    expect(wantsNearby(parseSearchParams({}), 0)).toBe(false);
    expect(wantsNearby(parseSearchParams({ ...PLACE, ["r"]: "15" }), 0)).toBe(false);
    expect(wantsNearby(parseSearchParams({ ...PLACE, ["r"]: "10" }), 0)).toBe(true);
  });

  it("asks for the same filters in the 15 km circle, nearest first, and a page long enough", () => {
    const wide = nearbySearchParams(
      parseSearchParams({ ...PLACE, listingType: "rent", bhk: "2", ["r"]: "2", sort: "price_asc" }),
    );
    expect(wide).toMatchObject({
      listingType: "rent",
      bhk: 2,
      lat: 12.98,
      radiusKm: 15,
      sort: "distance",
    });
    expect(wide.show).toBe(NEARBY_READ_SHOW);
    // The section's 12 and up to five homes already in the main list.
    expect(wide.show).toBeGreaterThanOrEqual(NEARBY_LIMIT + NEARBY_THRESHOLD - 1);
    expect(toSearchRpcArgs(wide)).toMatchObject({
      p_radius_km: 15,
      p_sort: "distance",
      p_listing_type: "rent",
      p_lat: 12.98,
      p_limit: NEARBY_READ_SHOW,
    });
  });

  it("writes the wide search as a valid address (the page parses the same rules)", () => {
    expect(buildSearchHref(nearbySearchParams(parseSearchParams(PLACE)))).toContain("r=15");
  });
});

describe("UT-nearby: the homes of the Also near section", () => {
  it("shows the wide circle's homes that are not in the main list, nearest first", () => {
    const main = homes(1, 2);
    const wide = [...homes(1, 2), ...homes(3, 4)];
    expect(ids(nearbyHomesToShow({ main, wide, radiusKm: 5 }))).toEqual(["h3", "h4", "h5", "h6"]);
  });

  it("removes a home that is in both lists, and lists a repeated home once", () => {
    const wide = [home("h1"), home("h9"), home("h9"), home("h8")];
    expect(ids(nearbyHomesToShow({ main: [home("h1")], wide, radiusKm: 5 }))).toEqual(["h9", "h8"]);
  });

  it("holds at most 12, and takes the limit as a parameter", () => {
    const wide = homes(10, 30);
    expect(nearbyHomesToShow({ main: [], wide, radiusKm: 5 })).toHaveLength(12);
    expect(nearbyHomesToShow({ main: [], wide, radiusKm: 5, limit: 3 })).toHaveLength(3);
  });

  it("shows nothing when the main list already has the threshold of homes", () => {
    expect(nearbyHomesToShow({ main: homes(1, 6), wide: homes(7, 3), radiusKm: 5 })).toEqual([]);
    expect(nearbyHomesToShow({ main: homes(1, 5), wide: homes(7, 3), radiusKm: 5 })).toHaveLength(
      3,
    );
    expect(
      nearbyHomesToShow({ main: homes(1, 5), wide: homes(7, 3), radiusKm: 5, threshold: 5 }),
    ).toEqual([]);
  });

  it("shows nothing when the chosen circle is already 15 km", () => {
    expect(nearbyHomesToShow({ main: [], wide: homes(1, 4), radiusKm: 15 })).toEqual([]);
  });

  it("shows nothing when the wider search adds no home, or finds none", () => {
    const main = homes(1, 3);
    expect(nearbyHomesToShow({ main, wide: main, radiusKm: 5 })).toEqual([]);
    expect(nearbyHomesToShow({ main, wide: [], radiusKm: 5 })).toEqual([]);
  });
});
