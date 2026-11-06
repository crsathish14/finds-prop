import { describe, expect, it, vi } from "vitest";
import type { PropertyData } from "@/features/property";

vi.mock("@/features/home", () => ({
  LISTING_BUCKET: "listing-photos",
  publicStorageUrl: (base: string, bucket: string, path: string) => `${base}/${bucket}/${path}`,
}));

const { toSavedCard } = await import("../cards");

const translate = Object.assign(
  (key: string, values?: Record<string, unknown>) => {
    return `${key}${values ? JSON.stringify(values) : ""}`;
  },
  { has: () => true },
) as never;

const home: PropertyData = {
  id: "11111111-1111-4111-8111-111111111111",
  shortId: "k3x9a2bd",
  slug: "sea-view-2-bhk",
  listingType: "rent",
  propertyType: "apartment",
  title: "Bright 2 BHK, a short walk from the river",
  description: null,
  bedrooms: 2,
  bathrooms: 2,
  areaSqft: 1040,
  price: 26000,
  furnishing: "semi",
  amenities: [],
  availableFrom: null,
  locality: "Velachery",
  city: "Chennai",
  state: "Tamil Nadu",
  featured: false,
  label: "prime",
  ageDays: 2,
  publishedAt: "2026-11-04T00:00:00Z",
  photos: [{ path: "a/cover.jpg", alt: "The living room" }],
};

describe("toSavedCard: a saved home as the search card draws it", () => {
  const context = { translate, supabaseUrl: "https://example.supabase.co" };

  it("links to the home's address and carries its facts", () => {
    const card = toSavedCard(home, context);
    expect(card.href).toBe("/properties/sea-view-2-bhk-k3x9a2bd");
    expect(card.title).toBe(home.title);
    expect(card.locality).toBe("Velachery");
    expect(card.city).toBe("Chennai");
    expect(card.rupees).toBe(26000);
    expect(card.listingType).toBe("rent");
    expect(card.bedrooms).toBe(2);
    expect(card.label).toBe("prime");
  });

  it("points the picture at the cover in the public bucket, with its own words", () => {
    expect(toSavedCard(home, context).cover).toEqual({
      src: "https://example.supabase.co/listing-photos/a/cover.jpg",
      alt: "The living room",
    });
  });

  it("has no picture and no alt text when the home has none", () => {
    const card = toSavedCard({ ...home, photos: [{ path: "a/x.jpg", alt: null }] }, context);
    expect(card.cover?.alt).toBe("");
    expect(toSavedCard({ ...home, photos: [] }, context).cover).toBeNull();
  });

  it("leaves out the age when the home has none", () => {
    expect(toSavedCard({ ...home, ageDays: null }, context)).not.toHaveProperty("listedAgo");
  });
});
