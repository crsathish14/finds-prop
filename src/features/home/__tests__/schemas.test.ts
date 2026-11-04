import { describe, expect, it } from "vitest";
import { listingRowSchema, projectRowSchema } from "../schemas";

const home = (overrides: Record<string, unknown> = {}) => ({
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
  label: "featured",
  published_at: "2026-11-01T06:00:00Z",
  cover_path: null,
  cover_alt: null,
  // `search_properties()` also returns these; the schema ignores what the cards do not use.
  id: "00000000-0000-0000-0000-000000000000",
  total_count: 40,
  ...overrides,
});

describe("UT-home-schemas: what the homepage accepts from the database", () => {
  it("accepts a home and ignores the columns the cards do not use", () => {
    const parsed = listingRowSchema.safeParse(home());
    expect(parsed.success).toBe(true);
    expect(parsed.success && "total_count" in parsed.data).toBe(false);
  });

  it("treats a label this site does not know as no label", () => {
    const parsed = listingRowSchema.safeParse(home({ label: "luxury" }));
    expect(parsed.success && parsed.data.label).toBeNull();
  });

  it("rejects a listing type that is neither sale nor rent, a missing slug and a negative price", () => {
    expect(listingRowSchema.safeParse(home({ listing_type: "lease" })).success).toBe(false);
    expect(listingRowSchema.safeParse(home({ slug: "" })).success).toBe(false);
    expect(listingRowSchema.safeParse(home({ price: -1 })).success).toBe(false);
  });

  it("accepts a project with its builder, and rejects one without", () => {
    const project = {
      slug: "kadal-vista",
      name: "Kadal Vista",
      builder_id: "b1",
      images: null,
      builders: { id: "b1", name: "Kadal Homes", description: null },
    };
    expect(projectRowSchema.safeParse(project).success).toBe(true);
    expect(projectRowSchema.safeParse({ ...project, builders: null }).success).toBe(false);
  });
});
