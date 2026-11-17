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

describe("a picked place on the search card (ADR-136)", () => {
  const KK_NAGAR = { label: "KK Nagar", lat: 13.0418, lng: 80.2341 };

  it("searches the picked place by its point, with the default radius, while the text is its name", () => {
    expect(searchHrefFromCard({ ...EMPTY, locality: "KK Nagar" }, CURATED, KK_NAGAR)).toBe(
      "/properties?lat=13.0418&listingType=sale&lng=80.2341&place=KK+Nagar",
    );
    expect(searchParamsFromCard({ ...EMPTY, locality: " KK Nagar " }, CURATED, KK_NAGAR)).toEqual({
      listingType: "sale",
      place: "KK Nagar",
      lat: 13.0418,
      lng: 80.2341,
    });
  });

  it("searches the text as a locality once it is no longer the picked name", () => {
    expect(
      searchParamsFromCard({ ...EMPTY, locality: "KK Nagar West" }, CURATED, KK_NAGAR),
    ).toEqual({ listingType: "sale", locality: "KK Nagar West" });
    expect(searchParamsFromCard({ ...EMPTY, locality: "kk nagar" }, CURATED, KK_NAGAR)).toEqual({
      listingType: "sale",
      locality: "kk nagar",
    });
  });

  it("does not use a picked place for an empty box, and a curated name stays the curated place", () => {
    expect(searchParamsFromCard(EMPTY, CURATED, KK_NAGAR)).toEqual({ listingType: "sale" });
    expect(
      searchParamsFromCard({ ...EMPTY, locality: "adyar" }, CURATED, {
        label: "adyar",
        lat: 1,
        lng: 2,
      }),
    ).toMatchObject({ place: "Adyar", lat: 13.0012, lng: 80.2565, radiusKm: 3 });
  });

  it("is unchanged without a pick", () => {
    expect(searchParamsFromCard({ ...EMPTY, locality: "Anywhere" }, CURATED, null)).toEqual({
      listingType: "sale",
      locality: "Anywhere",
    });
  });
});
