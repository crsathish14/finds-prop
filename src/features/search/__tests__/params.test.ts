import { describe, expect, it } from "vitest";
import {
  buildSearchHref,
  canonicalSearchHref,
  clearSearchFilters,
  parseSearchParams,
  searchRadiusKm,
} from "../params";
import { FILTER_FIELDS, SEARCH_FIELDS, addressName } from "../schemas";

// The radius and the keyword are `r` and `q` in an address; names are words in code (R-GEN-11).
const RADIUS = addressName("radiusKm");
const KEYWORD = addressName("keyword");
const DEFAULTS = { sort: "newest", show: 12, view: "grid" } as const;

describe("search address: reading it (frontend.md 6.1)", () => {
  it("has the defaults, and nothing else, for an empty address", () => {
    expect(parseSearchParams({})).toEqual(DEFAULTS);
    expect(parseSearchParams(new URLSearchParams())).toEqual(DEFAULTS);
  });

  it("reads every parameter of the contract", () => {
    const params = parseSearchParams({
      listingType: "rent",
      propertyType: "villa",
      bhk: "3",
      minPrice: "10000",
      maxPrice: "40000",
      place: "Adyar",
      lat: "13.0012",
      lng: "80.2565",
      [RADIUS]: "3",
      locality: "Adyar",
      [KEYWORD]: "garden",
      label: "prime",
      sort: "price_asc",
      show: "36",
      view: "list",
    });
    expect(params).toEqual({
      listingType: "rent",
      propertyType: "villa",
      bhk: 3,
      minPrice: 10_000,
      maxPrice: 40_000,
      place: "Adyar",
      lat: 13.0012,
      lng: 80.2565,
      radiusKm: 3,
      locality: "Adyar",
      keyword: "garden",
      label: "prime",
      sort: "price_asc",
      show: 36,
      view: "list",
    });
  });

  it("reads the browser's own query string the same way", () => {
    const params = parseSearchParams(new URLSearchParams("listingType=sale&bhk=2&q=sea+view"));
    expect(params).toMatchObject({ listingType: "sale", bhk: 2, keyword: "sea view" });
  });

  it("uses the first value when a parameter is repeated", () => {
    expect(parseSearchParams({ bhk: ["2", "4"] })).toMatchObject({ bhk: 2 });
    expect(parseSearchParams(new URLSearchParams("bhk=3&bhk=1"))).toMatchObject({ bhk: 3 });
  });

  it("drops a value that does not fit, and keeps the rest", () => {
    const params = parseSearchParams({
      listingType: "buy",
      propertyType: "castle",
      bhk: "7",
      maxPrice: "-5",
      minPrice: "1e9",
      label: "cheap",
      sort: "cheapest",
      view: "tiles",
      show: "13",
      locality: "Velachery",
    });
    expect(params).toEqual({ ...DEFAULTS, locality: "Velachery" });
  });

  it.each([
    ["bhk", "0"],
    ["bhk", "5"],
    ["bhk", "2.5"],
    ["bhk", "two"],
    ["maxPrice", "abc"],
    ["maxPrice", "1.5"],
    ["maxPrice", "9999999999999"],
    ["show", "0"],
    ["show", "11"],
    ["show", "132"],
    ["show", "1200"],
    ["place", "   "],
    ["place", "x".repeat(81)],
    ["locality", "x".repeat(81)],
    ["q", "x".repeat(121)],
  ])("drops %s=%s", (name, value) => {
    expect(parseSearchParams({ [name]: value })).toEqual(DEFAULTS);
  });

  it("accepts show in steps of 12 from 12 to 120", () => {
    for (const show of [12, 24, 60, 120]) {
      expect(parseSearchParams({ show: String(show) }).show).toBe(show);
    }
  });

  it("trims text", () => {
    expect(parseSearchParams({ locality: "  Adyar  ", [KEYWORD]: " sea view " })).toMatchObject({
      locality: "Adyar",
      keyword: "sea view",
    });
  });

  it("needs both lat and lng, and drops the radius with a lone coordinate", () => {
    expect(parseSearchParams({ lat: "13.0", [RADIUS]: "4" })).toEqual(DEFAULTS);
    expect(parseSearchParams({ lng: "80.2" })).toEqual(DEFAULTS);
    expect(parseSearchParams({ lat: "13.0", lng: "80.2", [RADIUS]: "4" })).toMatchObject({
      lat: 13,
      lng: 80.2,
      radiusKm: 4,
    });
  });

  it("drops a radius with no place, and a radius outside 1 to 50 km", () => {
    expect(parseSearchParams({ [RADIUS]: "4" })).toEqual(DEFAULTS);
    const params = parseSearchParams({ lat: "13", lng: "80", [RADIUS]: "51" });
    expect(params.radiusKm).toBeUndefined();
    expect(params.lat).toBe(13);
    expect(parseSearchParams({ lat: "13", lng: "80", [RADIUS]: "0.5" }).radiusKm).toBeUndefined();
  });

  it("drops coordinates outside the world, and outside the bounds when they are given", () => {
    expect(parseSearchParams({ lat: "91", lng: "80" })).toEqual(DEFAULTS);
    expect(parseSearchParams({ lat: "13", lng: "181" })).toEqual(DEFAULTS);
    const bounds = { south: 8, west: 76.2, north: 13.6, east: 80.4 };
    expect(parseSearchParams({ lat: "13", lng: "80", [RADIUS]: "5" }, { bounds })).toMatchObject({
      lat: 13,
    });
    // Mumbai is outside Tamil Nadu: the place and its radius go.
    expect(parseSearchParams({ lat: "19.07", lng: "72.87", [RADIUS]: "5" }, { bounds })).toEqual(
      DEFAULTS,
    );
  });

  it("falls back to the default radius when none is given", () => {
    expect(searchRadiusKm(parseSearchParams({ lat: "13", lng: "80" }))).toBe(5);
    expect(searchRadiusKm(parseSearchParams({ lat: "13", lng: "80", [RADIUS]: "12" }))).toBe(12);
  });
});

describe("search address: writing it", () => {
  it("is just the page for a search with nothing in it", () => {
    expect(buildSearchHref()).toBe("/properties");
    expect(buildSearchHref({})).toBe("/properties");
  });

  it("leaves out what is the default", () => {
    expect(
      buildSearchHref({ sort: "newest", show: 12, view: "grid", lat: 13, lng: 80, radiusKm: 5 }),
    ).toBe("/properties?lat=13&lng=80");
  });

  it("writes the parameters alphabetically, so one search has one address", () => {
    expect(buildSearchHref({ maxPrice: 7_500_000, listingType: "sale", bhk: 3 })).toBe(
      "/properties?bhk=3&listingType=sale&maxPrice=7500000",
    );
    expect(buildSearchHref({ bhk: 3, listingType: "sale", maxPrice: 7_500_000 })).toBe(
      buildSearchHref({ maxPrice: 7_500_000, bhk: 3, listingType: "sale" }),
    );
  });

  it("writes the radius and the keyword under their address names, r and q", () => {
    expect(
      buildSearchHref({ keyword: "sea view", lat: 13, lng: 80, radiusKm: 3, sort: "price_asc" }),
    ).toBe("/properties?lat=13&lng=80&q=sea+view&r=3&sort=price_asc");
  });

  it("encodes text safely", () => {
    const href = buildSearchHref({ locality: "OMR & Sholinganallur #2" });
    expect(href).toBe("/properties?locality=OMR+%26+Sholinganallur+%232");
    expect(parseSearchParams(new URL(href, "https://example.test").searchParams).locality).toBe(
      "OMR & Sholinganallur #2",
    );
  });

  it("keeps six decimals of a coordinate", () => {
    expect(buildSearchHref({ lat: 13.0827412345, lng: 80.270718 })).toBe(
      "/properties?lat=13.082741&lng=80.270718",
    );
  });

  it("leaves out a value that does not fit instead of writing it", () => {
    expect(buildSearchHref({ bhk: 9, listingType: "rent" })).toBe("/properties?listingType=rent");
    expect(buildSearchHref({ lat: 13 })).toBe("/properties");
    expect(buildSearchHref({ show: 13 })).toBe("/properties");
  });

  it("writes sort, view and show when they are not the default", () => {
    expect(buildSearchHref({ sort: "area_desc", view: "list", show: 24 })).toBe(
      "/properties?show=24&sort=area_desc&view=list",
    );
  });

  it("reads back what it wrote", () => {
    const original = parseSearchParams({
      listingType: "rent",
      propertyType: "apartment",
      bhk: "2",
      maxPrice: "25000",
      place: "Velachery",
      lat: "12.9815",
      lng: "80.2180",
      [RADIUS]: "2.5",
      [KEYWORD]: "metro",
      label: "budget",
      sort: "price_desc",
      show: "48",
      view: "list",
    });
    const href = buildSearchHref(original);
    expect(parseSearchParams(new URL(href, "https://example.test").searchParams)).toEqual(original);
  });

  it("knows every parameter by its address name, alphabetically", () => {
    expect(SEARCH_FIELDS.map(addressName)).toEqual([
      "bhk",
      "label",
      "lat",
      "listingType",
      "lng",
      "locality",
      "maxPrice",
      "minPrice",
      "place",
      "propertyType",
      "q",
      "r",
      "show",
      "sort",
      "view",
    ]);
  });
});

describe("search address: Clear all", () => {
  it("removes every filter and keeps sort and view", () => {
    const search = parseSearchParams({
      listingType: "sale",
      propertyType: "villa",
      bhk: "4",
      minPrice: "1",
      maxPrice: "99",
      place: "Adyar",
      lat: "13",
      lng: "80",
      [RADIUS]: "9",
      locality: "Adyar",
      [KEYWORD]: "pool",
      label: "prime",
      sort: "price_asc",
      view: "list",
      show: "60",
    });
    const cleared = clearSearchFilters(search);
    expect(cleared).toEqual({ sort: "price_asc", show: 12, view: "list" });
    expect(buildSearchHref(cleared)).toBe("/properties?sort=price_asc&view=list");
  });

  it("treats every parameter but sort, show and view as a filter", () => {
    const settings = SEARCH_FIELDS.filter(
      (field) => !(FILTER_FIELDS as readonly string[]).includes(field),
    );
    expect([...settings].sort()).toEqual(["show", "sort", "view"]);
  });
});

describe("UT-search-canonical: the canonical address of a search (FR-PUB-14)", () => {
  it("keeps the filters and drops the sort, the number shown and the view", () => {
    const params = parseSearchParams({
      listingType: "sale",
      bhk: "3",
      sort: "price_asc",
      show: "36",
      view: "list",
    });
    expect(canonicalSearchHref(params)).toBe(buildSearchHref({ listingType: "sale", bhk: 3 }));
  });

  it("gives the same address to a search however it is laid out", () => {
    const grid = parseSearchParams({ bhk: "2", view: "grid" });
    const list = parseSearchParams({ bhk: "2", view: "list", sort: "price_desc" });
    expect(canonicalSearchHref(grid)).toBe(canonicalSearchHref(list));
  });

  it("is the plain list address when nothing is filtered", () => {
    expect(canonicalSearchHref(parseSearchParams({ view: "list", sort: "price_asc" }))).toBe(
      "/properties",
    );
  });
});
