import { describe, expect, it } from "vitest";
import { listingRowSchema } from "../listing-row";

const ROW = {
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
  label: "prime",
  published_at: "2026-11-01T06:00:00Z",
  cover_path: null,
  cover_alt: null,
};

describe("UT-listing-row: the distance column of search_properties() (ADR-135, ADR-137)", () => {
  it("keeps distance_km as a number when a place was searched", () => {
    expect(listingRowSchema.parse({ ...ROW, distance_km: 2.4 }).distance_km).toBe(2.4);
    expect(listingRowSchema.parse({ ...ROW, distance_km: 0 }).distance_km).toBe(0);
  });

  it("keeps it null when no place was searched", () => {
    expect(listingRowSchema.parse({ ...ROW, distance_km: null }).distance_km).toBeNull();
  });

  it("still reads a row that has no such column", () => {
    expect(listingRowSchema.parse(ROW).distance_km).toBeUndefined();
  });

  it("refuses a distance that is not a number or is below zero, so the row is skipped", () => {
    expect(listingRowSchema.safeParse({ ...ROW, distance_km: "2.4" }).success).toBe(false);
    expect(listingRowSchema.safeParse({ ...ROW, distance_km: -1 }).success).toBe(false);
  });
});
