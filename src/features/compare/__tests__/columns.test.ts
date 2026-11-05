import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/property", async () => {
  const view = await import("@/features/property/view");
  const address = await import("@/features/property/address");
  return { ...view, ...address };
});

const { toCompareColumn } = await import("../columns");

const PROPERTY = {
  id: "00000000-0000-4000-8000-000000000001",
  shortId: "k3x9a2bd",
  slug: "3-bhk-velachery",
  listingType: "sale" as const,
  propertyType: "apartment" as const,
  title: "3 BHK apartment",
  description: null,
  bedrooms: 3,
  bathrooms: 2,
  areaSqft: 1420,
  price: 12_500_000,
  furnishing: "semi" as const,
  amenities: [" Gym ", "gym", "Lift", ""],
  availableFrom: null,
  locality: "Velachery",
  city: "Chennai",
  state: "Tamil Nadu",
  featured: false,
  label: "prime" as const,
  ageDays: 3,
  photos: [],
};

describe("UT-compare-columns: a home as a column", () => {
  it("takes what the table shows, with the page's address and the cover it is given", () => {
    expect(toCompareColumn(PROPERTY, "https://x.supabase.co/a.webp")).toEqual({
      shortId: "k3x9a2bd",
      href: "/properties/3-bhk-velachery-k3x9a2bd",
      title: "3 BHK apartment",
      listingType: "sale",
      price: 12_500_000,
      perSqftRupees: 8803,
      propertyType: "apartment",
      place: "Velachery, Chennai",
      areaSqft: 1420,
      bedrooms: 3,
      bathrooms: 2,
      furnishing: "semi",
      amenities: ["Gym", "Lift"],
      label: "prime",
      cover: "https://x.supabase.co/a.webp",
    });
  });

  it("has no price per sq.ft for a rent, and no area, bedrooms or place when they are not given", () => {
    const column = toCompareColumn(
      { ...PROPERTY, listingType: "rent", areaSqft: 0, bedrooms: 0, locality: null, city: null },
      null,
    );
    expect(column.perSqftRupees).toBeUndefined();
    expect(column.areaSqft).toBeNull();
    expect(column.bedrooms).toBeNull();
    expect(column.place).toBeNull();
    expect(column.cover).toBeNull();
  });
});
