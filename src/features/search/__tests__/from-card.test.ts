import { describe, expect, it } from "vitest";
import {
  listingTypeFor,
  placeParams,
  searchHrefFromCard,
  searchParamsFromCard,
  type CardSearch,
  type CuratedLocality,
} from "../from-card";

const EMPTY: CardSearch = {
  intent: "buy",
  locality: "",
  propertyType: null,
  bedrooms: null,
  maxBudget: null,
};

const ADYAR: CuratedLocality = { label: "Adyar", lat: 13.0012, lng: 80.2565, radiusKm: 3 };
const PORUR: CuratedLocality = { label: "Porur", lat: 13.0382, lng: 80.1565, radiusKm: 4 };
const CURATED = [ADYAR, PORUR];

describe("the search card as an address (S4-T06)", () => {
  it("maps Looking to: Buy is sale, Rent is rent, All is no filter", () => {
    expect(listingTypeFor("buy")).toBe("sale");
    expect(listingTypeFor("rent")).toBe("rent");
    expect(listingTypeFor("all")).toBeUndefined();
  });

  it("searches all homes to buy for a card with nothing else chosen", () => {
    expect(searchParamsFromCard(EMPTY)).toEqual({ listingType: "sale" });
    expect(searchHrefFromCard(EMPTY)).toBe("/properties?listingType=sale");
  });

  it("searches homes to rent when Rent is chosen", () => {
    expect(searchHrefFromCard({ ...EMPTY, intent: "rent" })).toBe("/properties?listingType=rent");
  });

  it("writes the kind of property, the bedrooms and the budget when they are chosen", () => {
    expect(
      searchHrefFromCard({
        ...EMPTY,
        propertyType: "apartment",
        bedrooms: 3,
        maxBudget: 1_50_00_000,
      }),
    ).toBe("/properties?bhk=3&listingType=sale&maxPrice=15000000&propertyType=apartment");
  });

  it("sends other text as a locality text match", () => {
    expect(searchParamsFromCard({ ...EMPTY, locality: "  Velachery " }, CURATED)).toEqual({
      listingType: "sale",
      locality: "Velachery",
    });
  });

  it("sends a curated locality as its place, coordinates and radius, whatever its capitals", () => {
    const expected = {
      listingType: "sale",
      place: "Adyar",
      lat: 13.0012,
      lng: 80.2565,
      radiusKm: 3,
    };
    expect(searchParamsFromCard({ ...EMPTY, locality: "Adyar" }, CURATED)).toEqual(expected);
    expect(searchParamsFromCard({ ...EMPTY, locality: " aDYAR " }, CURATED)).toEqual(expected);
  });

  it("writes the whole card as one address, alphabetically", () => {
    expect(
      searchHrefFromCard(
        {
          intent: "rent",
          locality: "porur",
          propertyType: "house",
          bedrooms: 2,
          maxBudget: 25_000,
        },
        CURATED,
      ),
    ).toBe(
      "/properties?bhk=2&lat=13.0382&listingType=rent&lng=80.1565&maxPrice=25000&place=Porur&propertyType=house&r=4",
    );
  });

  it("keeps a curated radius within what a search accepts", () => {
    expect(placeParams({ ...ADYAR, radiusKm: 0.4 }).radiusKm).toBe(1);
    expect(placeParams({ ...ADYAR, radiusKm: 80 }).radiusKm).toBe(50);
    expect(placeParams({ ...ADYAR, radiusKm: 7 }).radiusKm).toBe(7);
  });

  it("is a link for a Popular chip: the curated place alone", () => {
    const href = searchHrefFromCard({ ...EMPTY, locality: "Porur" }, CURATED);
    expect(href).toBe("/properties?lat=13.0382&listingType=sale&lng=80.1565&place=Porur&r=4");
  });
});
