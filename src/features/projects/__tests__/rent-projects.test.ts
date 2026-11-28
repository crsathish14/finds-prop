import { describe, expect, it } from "vitest";
import { parseSearchParams } from "@/features/search";
import type { ProjectKind } from "../queries";
import type { ProjectListItem } from "../types";
import { pickRentProjects, RENT_PROJECTS_MAX, wantsRentProjects } from "../rent-projects";

// UT-project-rent-projects (ADR-219). Fictional projects only.
function project(slug: string, extra: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    slug,
    name: slug,
    developerName: "Kadal Homes",
    status: "ready_to_move",
    offerType: "rent",
    price: 28_000,
    priceType: "rent_per_month",
    bhkOptions: [2, 3],
    locality: "Velachery",
    coverPath: null,
    featured: false,
    ...extra,
  };
}

const residential = (propertyType = "apartment"): ProjectKind => ({
  projectType: "residential",
  propertyType,
});

function kindsOf(entries: Record<string, ProjectKind>): Map<string, ProjectKind> {
  return new Map(Object.entries(entries));
}

const slugs = (list: readonly ProjectListItem[]) => list.map((item) => item.slug);

describe("wantsRentProjects", () => {
  it("is true for a rent search of a kind a residential project can be", () => {
    expect(wantsRentProjects(parseSearchParams({ listingType: "rent" }))).toBe(true);
    expect(
      wantsRentProjects(parseSearchParams({ listingType: "rent", propertyType: "villa" })),
    ).toBe(true);
  });

  it("is false for a buy search, a search with no type, a house or commercial", () => {
    expect(wantsRentProjects(parseSearchParams({ listingType: "sale" }))).toBe(false);
    expect(wantsRentProjects(parseSearchParams({}))).toBe(false);
    expect(
      wantsRentProjects(parseSearchParams({ listingType: "rent", propertyType: "house" })),
    ).toBe(false);
    expect(
      wantsRentProjects(parseSearchParams({ listingType: "rent", propertyType: "commercial" })),
    ).toBe(false);
  });
});

describe("pickRentProjects", () => {
  const RENT = parseSearchParams({ listingType: "rent" });

  it("keeps residential projects for rent per month only", () => {
    const list = [
      project("rent-flat"),
      project("sale-flat", { offerType: null, priceType: "basic", price: 7_500_000 }),
      project("office-rent"),
      project("per-sqft", { priceType: "rent_per_sqft_month", price: 60 }),
      project("unknown-kind"),
    ];
    const kinds = kindsOf({
      "rent-flat": residential(),
      "sale-flat": residential(),
      "office-rent": { projectType: "commercial", propertyType: "office" },
      "per-sqft": residential(),
    });
    expect(slugs(pickRentProjects(list, kinds, RENT))).toEqual(["rent-flat"]);
  });

  it("narrows by property type, bedrooms and budget", () => {
    const list = [
      project("villa", { bhkOptions: [3], price: 45_000 }),
      project("flat-cheap", { price: 18_000 }),
      project("flat-dear", { price: 55_000 }),
      project("flat-no-price", { price: null }),
    ];
    const kinds = kindsOf({
      villa: residential("villa"),
      "flat-cheap": residential(),
      "flat-dear": residential(),
      "flat-no-price": residential(),
    });
    expect(
      slugs(
        pickRentProjects(
          list,
          kinds,
          parseSearchParams({ listingType: "rent", propertyType: "villa" }),
        ),
      ),
    ).toEqual(["villa"]);
    expect(
      slugs(
        pickRentProjects(
          list,
          kinds,
          parseSearchParams({ listingType: "rent", maxPrice: "40000" }),
        ),
      ),
    ).toEqual(["flat-cheap"]);
    expect(
      slugs(pickRentProjects(list, kinds, parseSearchParams({ listingType: "rent", bhk: "3" }))),
    ).toEqual(["villa", "flat-cheap", "flat-dear", "flat-no-price"]);
    expect(
      slugs(pickRentProjects(list, kinds, parseSearchParams({ listingType: "rent", bhk: "4" }))),
    ).toEqual([]);
  });

  it("puts the searched area first, then the rest of the city, at most six", () => {
    const list = Array.from({ length: 8 }, (_value, index) =>
      project(`p${index}`, { locality: index >= 6 ? "Anna Nagar West" : "Velachery" }),
    );
    const kinds = kindsOf(Object.fromEntries(list.map((item) => [item.slug, residential()])));
    const picked = pickRentProjects(
      list,
      kinds,
      parseSearchParams({ listingType: "rent", locality: "anna nagar" }),
    );
    expect(picked).toHaveLength(RENT_PROJECTS_MAX);
    expect(slugs(picked)).toEqual(["p6", "p7", "p0", "p1", "p2", "p3"]);
  });

  it("gives none for a buy search", () => {
    const list = [project("rent-flat")];
    const kinds = kindsOf({ "rent-flat": residential() });
    expect(pickRentProjects(list, kinds, parseSearchParams({ listingType: "sale" }))).toEqual([]);
  });
});
