import { describe, expect, it } from "vitest";
import { buildSearchHref } from "../params";
import { listingTypeFor, placeParams, type CuratedLocality } from "../from-card";

const PORUR: CuratedLocality = { label: "Porur", lat: 13.0382, lng: 80.1565, radiusKm: 4 };

describe("the filters' choices as search values (S4-T06)", () => {
  it("maps Looking to: Buy is sale, Rent is rent, All is no filter", () => {
    expect(listingTypeFor("buy")).toBe("sale");
    expect(listingTypeFor("rent")).toBe("rent");
    expect(listingTypeFor("all")).toBeUndefined();
  });

  it("keeps a curated radius within what a search accepts", () => {
    expect(placeParams({ ...PORUR, radiusKm: 0.4 }).radiusKm).toBe(1);
    expect(placeParams({ ...PORUR, radiusKm: 80 }).radiusKm).toBe(50);
    expect(placeParams({ ...PORUR, radiusKm: 7 }).radiusKm).toBe(7);
  });

  it("makes a curated locality a search of its place alone", () => {
    expect(buildSearchHref(placeParams(PORUR))).toBe(
      "/properties?lat=13.0382&lng=80.1565&place=Porur&r=4",
    );
  });
});
