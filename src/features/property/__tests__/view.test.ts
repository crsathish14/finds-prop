import { describe, expect, it } from "vitest";
import type { PropertyData } from "../types";
import {
  amenityList,
  descriptionParagraphs,
  hasLeftOutDetails,
  metaDescription,
  perSqftRupees,
  placeLine,
  specItems,
} from "../view";

const HOME: PropertyData = {
  id: "00000000-0000-4000-8000-000000000001",
  shortId: "k3x9a2bd",
  slug: "3-bhk-apartment-velachery",
  listingType: "sale",
  propertyType: "apartment",
  title: "3 BHK apartment with clubhouse and covered parking",
  description: "A bright east-facing apartment.\n\nResidents share a clubhouse.",
  bedrooms: 3,
  bathrooms: 2,
  areaSqft: 1420,
  price: 12_500_000,
  furnishing: "semi",
  amenities: ["Gym", "Lift"],
  availableFrom: null,
  locality: "Velachery",
  city: "Chennai",
  state: "Tamil Nadu",
  featured: true,
  label: "featured",
  ageDays: 2,
  photos: [],
};

const home = (overrides: Partial<PropertyData> = {}): PropertyData => ({ ...HOME, ...overrides });

describe("UT-property-view: At a glance", () => {
  it("lists bedrooms, bathrooms, area, kind, furnishing and when it was listed, in the UX order", () => {
    expect(specItems(HOME)).toEqual([
      { key: "bedrooms", value: 3 },
      { key: "bathrooms", value: 2 },
      { key: "area", value: 1420 },
      { key: "propertyType", value: "apartment" },
      { key: "furnishing", value: "semi" },
      { key: "listed", value: 2 },
    ]);
  });

  it("leaves out what the owner did not give, rather than showing a blank", () => {
    const keys = specItems(
      home({ bathrooms: null, furnishing: null, areaSqft: null, ageDays: null }),
    ).map((item) => item.key);
    expect(keys).toEqual(["bedrooms", "propertyType"]);
  });

  it("leaves out bedrooms for a plot, a commercial property and a count of 0", () => {
    expect(
      specItems(home({ propertyType: "plot", bedrooms: null })).map((item) => item.key),
    ).not.toContain("bedrooms");
    expect(specItems(home({ bedrooms: 0 })).map((item) => item.key)).not.toContain("bedrooms");
  });

  it("does not show an area of nothing", () => {
    expect(specItems(home({ areaSqft: 0 })).map((item) => item.key)).not.toContain("area");
  });

  it("shows a listing of today as 0 days", () => {
    expect(specItems(home({ ageDays: 0 })).at(-1)).toEqual({ key: "listed", value: 0 });
  });
});

describe("UT-property-view: price per square foot", () => {
  it("is the rounded price over the area, for a sale", () => {
    expect(perSqftRupees(HOME)).toBe(8803);
  });

  it("is left out for a rent", () => {
    expect(perSqftRupees(home({ listingType: "rent", price: 48_000 }))).toBeUndefined();
  });

  it("is left out when the area is not known or is nothing", () => {
    expect(perSqftRupees(home({ areaSqft: null }))).toBeUndefined();
    expect(perSqftRupees(home({ areaSqft: 0 }))).toBeUndefined();
  });
});

describe("UT-property-view: the description", () => {
  it("splits on blank lines and keeps a single line break inside its paragraph", () => {
    expect(descriptionParagraphs("First line\nstill first.\n\nSecond.\r\n\r\n\r\nThird.")).toEqual([
      "First line\nstill first.",
      "Second.",
      "Third.",
    ]);
  });

  it("gives no paragraphs for no description or only blanks", () => {
    expect(descriptionParagraphs(null)).toEqual([]);
    expect(descriptionParagraphs(" \n\n \n ")).toEqual([]);
  });

  it("keeps markup as plain text: it is never read as HTML", () => {
    expect(descriptionParagraphs("<b>bold</b> <script>x()</script>")).toEqual([
      "<b>bold</b> <script>x()</script>",
    ]);
  });

  it("cuts the page description at a whole word with an ellipsis, and leaves a short one whole", () => {
    expect(metaDescription(HOME)).toBe("A bright east-facing apartment.");
    const long = metaDescription(home({ description: `${"word ".repeat(60)}end` })) ?? "";
    expect(long.length).toBeLessThanOrEqual(156);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/wor…$/);
    expect(metaDescription(home({ description: null }))).toBeNull();
  });

  it("flattens a paragraph's line breaks in the page description", () => {
    expect(metaDescription(home({ description: "One\ntwo  three" }))).toBe("One two three");
  });
});

describe("UT-property-view: amenities", () => {
  it("keeps the owner's words and order, drops empties and repeats (capitals ignored)", () => {
    expect(amenityList([" Gym ", "", "gym", "Swimming Pool", "  ", "Lift", "LIFT"])).toEqual([
      "Gym",
      "Swimming Pool",
      "Lift",
    ]);
  });
});

describe("UT-property-view: left-out details and the place", () => {
  it("knows when a detail the UX shows is missing", () => {
    expect(hasLeftOutDetails(HOME)).toBe(false);
    expect(hasLeftOutDetails(home({ bathrooms: null }))).toBe(true);
    expect(hasLeftOutDetails(home({ furnishing: null }))).toBe(true);
    expect(hasLeftOutDetails(home({ amenities: [] }))).toBe(true);
    expect(hasLeftOutDetails(home({ amenities: ["  "] }))).toBe(true);
  });

  it("does not count 'available from', which the page does not draw", () => {
    expect(hasLeftOutDetails(home({ availableFrom: null }))).toBe(false);
  });

  it("names the place as locality then city, whichever exist", () => {
    expect(placeLine(HOME)).toEqual({ locality: "Velachery", line: "Velachery, Chennai" });
    expect(placeLine(home({ locality: null }))).toEqual({ locality: null, line: "Chennai" });
    expect(placeLine(home({ locality: null, city: null })).line).toBe("");
  });
});
