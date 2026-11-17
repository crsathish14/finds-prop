import { describe, expect, it } from "vitest";
import type { FilterValues } from "@/config/search-options";
import en from "@/i18n/messages/en.json";
import type { Translate } from "@/lib/format";
import type { CuratedLocality } from "../from-card";
import { buildSearchHref, parseSearchParams } from "../params";
import {
  appliedFilters,
  atShowLimit,
  canonicalRedirect,
  changeSearch,
  filterValuesFromParams,
  hasFilters,
  nextShow,
  resultsHeading,
  resultsMeta,
  searchFromFilterValues,
  withoutFilter,
} from "../results-view";

const VELACHERY: CuratedLocality = { label: "Velachery", lat: 12.9815, lng: 80.2209, radiusKm: 4 };
const CURATED = [VELACHERY];

/** A translator that reads the real English messages, so the words are the shipped ones. */
const translate: Translate = (key, values = {}) => {
  let node: unknown = en;
  for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
  if (typeof node !== "string") throw new Error(`no message ${key}`);
  const plural = /^\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}$/.exec(node);
  if (plural) {
    const [, name = "", one = "", other = ""] = plural;
    const text = Number(values[name]) === 1 ? one : other;
    return text.replace("#", String(values[name]));
  }
  return node.replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ""));
};

const parse = (raw: Record<string, string>) => parseSearchParams(raw);

describe("UT-results-view: the address as filter values", () => {
  it("reads Looking to, place, type, bedrooms and budget", () => {
    const params = parse({
      listingType: "rent",
      place: "Velachery",
      lat: "12.9815",
      lng: "80.2209",
      propertyType: "villa",
      bhk: "3",
      maxPrice: "40000",
      sort: "price_asc",
    });
    expect(filterValuesFromParams(params)).toEqual({
      intent: "rent",
      locality: "Velachery",
      point: { lat: 12.9815, lng: 80.2209 },
      propertyType: "villa",
      bedrooms: 3,
      maxBudget: 40_000,
      sort: "price_asc",
    });
  });

  it("reads an empty address as All with nothing set", () => {
    expect(filterValuesFromParams(parse({}))).toEqual({
      intent: "all",
      locality: null,
      point: null,
      propertyType: null,
      bedrooms: null,
      maxBudget: null,
      sort: "newest",
    });
  });

  it("reads a text locality when no place was picked", () => {
    expect(filterValuesFromParams(parse({ locality: "Adyar" })).locality).toBe("Adyar");
  });
});

describe("UT-results-view: filter values as a search", () => {
  const values: FilterValues = {
    intent: "buy",
    locality: "velachery",
    propertyType: "apartment",
    bedrooms: 3,
    maxBudget: 1_50_00_000,
    sort: "price_desc",
  };

  it("turns a curated locality into its place, point and radius, whatever the capitals", () => {
    const href = buildSearchHref(searchFromFilterValues(parse({}), values, CURATED));
    expect(href).toBe(
      "/properties?bhk=3&lat=12.9815&listingType=sale&lng=80.2209&maxPrice=15000000&place=Velachery&propertyType=apartment&r=4&sort=price_desc",
    );
  });

  it("turns any other locality into a text match", () => {
    const patch = searchFromFilterValues(parse({}), { ...values, locality: "Adyar" }, CURATED);
    expect(patch.locality).toBe("Adyar");
    expect(patch.place).toBeUndefined();
  });

  it("drops the budget while Looking to is All, and keeps the keyword, label and view", () => {
    const params = parse({ ["q"]: "park", label: "prime", view: "list", show: "36" });
    const patch = searchFromFilterValues(params, { ...values, intent: "all" }, CURATED);
    expect(patch.maxPrice).toBeUndefined();
    expect(patch).toMatchObject({ keyword: "park", label: "prime", view: "list" });
    expect(patch.listingType).toBeUndefined();
  });

  it("starts the changed search from its first page", () => {
    const patch = searchFromFilterValues(parse({ show: "36" }), values, CURATED);
    expect(patch.show).toBeUndefined();
    expect(changeSearch(parse({ show: "36", sort: "price_asc" }), { label: "prime" })).toEqual({
      sort: "price_asc",
      view: "grid",
      label: "prime",
    });
    expect(changeSearch(parse({ show: "36" }), { show: 48 }).show).toBe(48);
  });
});

describe("UT-results-view: the applied filters", () => {
  const params = parse({
    listingType: "sale",
    place: "Velachery",
    lat: "12.9815",
    lng: "80.2209",
    propertyType: "apartment",
    bhk: "3",
    maxPrice: "15000000",
    ["q"]: "park",
  });

  it("lists them in the UX order with the words of the screen", () => {
    expect(appliedFilters(params, translate, "en-IN")).toEqual([
      { id: "place", label: "Velachery" },
      { id: "propertyType", label: "Apartment" },
      { id: "bhk", label: "3 BHK" },
      { id: "maxPrice", label: "Up to ₹1.5 Cr" },
      { id: "keyword", label: "“park”" },
    ]);
  });

  it("does not list Looking to, the label, sort or view", () => {
    const quiet = parse({ listingType: "rent", label: "prime", sort: "price_asc", view: "list" });
    expect(appliedFilters(quiet, translate, "en-IN")).toEqual([]);
  });

  it("takes the place off with its point and radius, and keeps the rest", () => {
    const patch = withoutFilter(params, "place");
    expect(patch).not.toHaveProperty("place");
    expect(patch).not.toHaveProperty("lat");
    expect(patch).not.toHaveProperty("lng");
    expect(patch).toMatchObject({ propertyType: "apartment", bhk: 3, keyword: "park" });
  });

  it("takes one filter off at a time and starts again from the first page", () => {
    expect(withoutFilter(parse({ bhk: "3", show: "48" }), "bhk")).toEqual({
      sort: "newest",
      view: "grid",
    });
    expect(withoutFilter(parse({ maxPrice: "100", ["q"]: "x" }), "keyword")).toMatchObject({
      maxPrice: 100,
    });
  });

  it("knows whether any filter is set", () => {
    expect(hasFilters(parse({}))).toBe(false);
    expect(hasFilters(parse({ sort: "price_asc", view: "list", show: "24" }))).toBe(false);
    expect(hasFilters(parse({ label: "prime" }))).toBe(true);
  });
});

describe("UT-results-view: Show more", () => {
  it("adds twelve at a time and stops at 120", () => {
    expect(nextShow(12)).toBe(24);
    expect(nextShow(108)).toBe(120);
    expect(nextShow(120)).toBe(120);
    expect(atShowLimit(108)).toBe(false);
    expect(atShowLimit(120)).toBe(true);
  });
});

describe("UT-results-view: the heading", () => {
  it("reads like the UX: kind, Looking to, then the place in copper", () => {
    const params = parse({
      listingType: "sale",
      propertyType: "apartment",
      place: "Velachery",
      lat: "12.9815",
      lng: "80.2209",
    });
    expect(resultsHeading(params, translate)).toEqual({
      title: "Apartments for sale in Velachery",
      emphasis: "Velachery",
    });
  });

  it("names every kind of property and every Looking to", () => {
    const kinds = {
      villa: "Villas",
      house: "Houses",
      plot: "Plots",
      commercial: "Commercial properties",
    };
    for (const [type, word] of Object.entries(kinds)) {
      const heading = resultsHeading(parse({ propertyType: type, listingType: "rent" }), translate);
      expect(heading.title).toBe(`${word} for rent`);
    }
  });

  it("says Homes for sale and rent when nothing is chosen, with no emphasis", () => {
    expect(resultsHeading(parse({}), translate)).toEqual({ title: "Homes for sale and rent" });
  });

  it("uses a text locality as the place too", () => {
    expect(resultsHeading(parse({ locality: "Adyar" }), translate)).toEqual({
      title: "Homes for sale and rent in Adyar",
      emphasis: "Adyar",
    });
  });
});

describe("UT-results-view: the canonical address", () => {
  it("leaves a canonical address alone", () => {
    const raw = { bhk: "3", listingType: "sale" };
    expect(canonicalRedirect(raw, parse(raw))).toBeNull();
    expect(canonicalRedirect({}, parse({}))).toBeNull();
  });

  it("sends a hand-edited address to its canonical form: order, defaults and invalid values", () => {
    const raw = { sort: "newest", bhk: "9", listingType: "sale", view: "grid" };
    expect(canonicalRedirect(raw, parse(raw))).toBe("/properties?listingType=sale");
  });

  it("sends an address with its parameters in another order to the alphabetical one", () => {
    const raw = { listingType: "sale", bhk: "3" };
    expect(canonicalRedirect(raw, parse(raw))).toBe("/properties?bhk=3&listingType=sale");
  });

  it("drops a place with only one coordinate", () => {
    const raw = { lat: "12.9", listingType: "rent" };
    expect(canonicalRedirect(raw, parse(raw))).toBe("/properties?listingType=rent");
  });

  it("leaves parameters outside the contract alone (a campaign tag)", () => {
    const raw = { listingType: "sale", utm_source: "mail" };
    expect(canonicalRedirect(raw, parse(raw))).toBeNull();
  });

  it("is a fixed point: the canonical address is its own canonical form", () => {
    const raw = {
      show: "036",
      sort: "price_asc",
      place: "Velachery",
      lat: "12.98150000",
      lng: "80.2209",
      ["r"]: "04",
      maxPrice: "15000000",
    };
    const first = canonicalRedirect(raw, parse(raw));
    expect(first).not.toBeNull();
    const query = Object.fromEntries(new URL(first ?? "", "http://localhost").searchParams);
    expect(canonicalRedirect(query, parse(query))).toBeNull();
  });
});

describe("UT-results-meta: what the results page says about itself (FR-PUB-14)", () => {
  const meta = (raw: Record<string, string>) => resultsMeta(parse(raw), translate, "en");

  it("is the plain title and a description of the homes when nothing is filtered", () => {
    expect(meta({})).toEqual({
      title: "Properties",
      description: "Homes for sale and rent. Photos, prices and details of homes on Find Prop.",
    });
  });

  it("follows the heading when the search is for a place and a kind of home", () => {
    expect(meta({ listingType: "sale", propertyType: "apartment", locality: "Velachery" })).toEqual(
      {
        title: "Apartments for sale in Velachery",
        description:
          "Apartments for sale in Velachery. Photos, prices and details of homes on Find Prop.",
      },
    );
  });

  it("adds the bedrooms, budget and keyword the heading does not say, so each search is unique", () => {
    const three = meta({ listingType: "rent", bhk: "3", maxPrice: "5000000" });
    const two = meta({ listingType: "rent", bhk: "2", maxPrice: "5000000" });
    expect(three.title).toMatch(/^Homes for rent, 3 BHK, /);
    expect(three.title).not.toBe(two.title);
    expect(three.description).toContain(three.title);
  });

  it("does not say the place or the kind twice", () => {
    const { title } = meta({ propertyType: "villa", locality: "ECR", bhk: "4" });
    expect(title.match(/ECR/g)).toHaveLength(1);
    expect(title).not.toMatch(/Villa,/);
  });

  it("gives a different title to a different search", () => {
    const titles = [
      meta({}),
      meta({ listingType: "sale" }),
      meta({ listingType: "rent" }),
      meta({ bhk: "3" }),
      meta({ locality: "Adyar" }),
      meta({ locality: "Velachery" }),
    ].map((entry) => entry.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe("UT-results-view: a place with a point from the place search (ADR-136)", () => {
  const values: FilterValues = {
    intent: "buy",
    locality: "KK Nagar",
    point: { lat: 13.0418, lng: 80.2341 },
    propertyType: null,
    bedrooms: 2,
    maxBudget: null,
    sort: "newest",
  };

  it("reads the point of a place in the address, and none for a text match", () => {
    expect(
      filterValuesFromParams(parse({ place: "KK Nagar", lat: "13.0418", lng: "80.2341" })).point,
    ).toEqual({ lat: 13.0418, lng: 80.2341 });
    expect(filterValuesFromParams(parse({ locality: "Adyar" })).point).toBeNull();
  });

  it("searches a place with a point by that point and keeps the radius the address has", () => {
    const params = parse({ place: "Old", lat: "13.1", lng: "80.1", ["r"]: "10" });
    const href = buildSearchHref(searchFromFilterValues(params, values, CURATED));
    expect(href).toBe(
      "/properties?bhk=2&lat=13.0418&listingType=sale&lng=80.2341&place=KK+Nagar&r=10",
    );
  });

  it("uses the default radius when the address had none", () => {
    const href = buildSearchHref(searchFromFilterValues(parse({}), values, CURATED));
    expect(href).toBe("/properties?bhk=2&lat=13.0418&listingType=sale&lng=80.2341&place=KK+Nagar");
  });

  it("gives a text locality no point, and ignores a point when there is no locality", () => {
    const text = searchFromFilterValues(parse({}), { ...values, point: null }, CURATED);
    expect(text.locality).toBe("KK Nagar");
    expect(text.lat).toBeUndefined();
    const none = searchFromFilterValues(parse({}), { ...values, locality: null }, CURATED);
    expect(none.lat).toBeUndefined();
    expect(none.place).toBeUndefined();
  });

  it("keeps a curated name the curated place, even with a point", () => {
    const patch = searchFromFilterValues(parse({}), { ...values, locality: "Velachery" }, CURATED);
    expect(patch).toMatchObject({ place: "Velachery", lat: 12.9815, radiusKm: 4 });
  });
});

describe("UT-results-view: the distance chips and the distance sort (ADR-137)", () => {
  const placed = { place: "Old", lat: "13.1", lng: "80.1" };
  const base = filterValuesFromParams(parse(placed));

  it("reads the radius in the address as a filter value, and none when the default is in use", () => {
    expect(filterValuesFromParams(parse({ ...placed, ["r"]: "10" })).radiusKm).toBe(10);
    expect(filterValuesFromParams(parse(placed))).not.toHaveProperty("radiusKm");
    expect(filterValuesFromParams(parse({ sort: "price_asc" }))).not.toHaveProperty("radiusKm");
  });

  it("reads sort=distance as a filter value only with a place", () => {
    expect(filterValuesFromParams(parse({ ...placed, sort: "distance" })).sort).toBe("distance");
    expect(filterValuesFromParams(parse({ sort: "distance" })).sort).toBe("newest");
  });

  it("sets the radius when a chip is chosen, and leaves it out for the default 5 km", () => {
    const params = parse(placed);
    expect(
      buildSearchHref(searchFromFilterValues(params, { ...base, radiusKm: 10 }, CURATED)),
    ).toBe("/properties?lat=13.1&lng=80.1&place=Old&r=10");
    const wide = parse({ ...placed, ["r"]: "10" });
    expect(
      buildSearchHref(
        searchFromFilterValues(wide, { ...filterValuesFromParams(wide), radiusKm: 5 }, CURATED),
      ),
    ).toBe("/properties?lat=13.1&lng=80.1&place=Old");
  });

  it("keeps a radius the chips do not offer while no chip is chosen", () => {
    const params = parse({ ...placed, ["r"]: "7" });
    expect(
      buildSearchHref(searchFromFilterValues(params, filterValuesFromParams(params), CURATED)),
    ).toBe("/properties?lat=13.1&lng=80.1&place=Old&r=7");
  });

  it("keeps the distance sort with the place, and drops it when the place goes", () => {
    const params = parse({ ...placed, sort: "distance" });
    const values = filterValuesFromParams(params);
    expect(buildSearchHref(searchFromFilterValues(params, values, CURATED))).toContain(
      "sort=distance",
    );
    expect(
      buildSearchHref(searchFromFilterValues(params, { ...values, locality: null }, CURATED)),
    ).toBe("/properties");
    expect(buildSearchHref(withoutFilter(params, "place"))).toBe("/properties");
  });
});
