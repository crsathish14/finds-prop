import { describe, expect, it } from "vitest";
import { PROJECT_PRIME_DEFAULTS } from "@/lib/project-prime";
import { toProjectCard } from "../cards";
import type { ProjectListItem } from "../types";

const item = (overrides: Partial<ProjectListItem> = {}): ProjectListItem => ({
  slug: "kadal-vista",
  name: "Kadal Vista",
  developerName: "Kadal Homes",
  status: "new_launch",
  offerType: null,
  price: 7_800_000,
  priceType: "basic",
  bhkOptions: [2, 3],
  locality: "OMR Navalur",
  coverPath: "kadal/front view.webp",
  featured: true,
  ...overrides,
});

describe("UT-project-cards: a project as the card takes it", () => {
  it("links to the project's page and carries the facts as they are", () => {
    expect(
      toProjectCard(item(), "https://example.supabase.co", PROJECT_PRIME_DEFAULTS),
    ).toMatchObject({
      href: "/projects/kadal-vista",
      name: "Kadal Vista",
      developerName: "Kadal Homes",
      locality: "OMR Navalur",
      priceRupees: 7_800_000,
      priceType: "basic",
      offerType: null,
      bedrooms: [2, 3],
      status: "new_launch",
      featured: true,
    });
  });

  it("draws the cover from the public project bucket, each part of the path encoded", () => {
    expect(
      toProjectCard(item(), "https://example.supabase.co/", PROJECT_PRIME_DEFAULTS).cover,
    ).toEqual({
      src: "https://example.supabase.co/storage/v1/object/public/project-media/kadal/front%20view.webp",
      alt: "Kadal Vista",
    });
  });

  it("has no cover when the project has no picture", () => {
    expect(
      toProjectCard(
        item({ coverPath: null }),
        "https://example.supabase.co",
        PROJECT_PRIME_DEFAULTS,
      ).cover,
    ).toBeNull();
  });

  it("carries the price type and the sale or rent choice of a commercial project", () => {
    expect(
      toProjectCard(
        item({ price: 85, priceType: "rent_per_sqft_month", offerType: "rent" }),
        "https://example.supabase.co",
        PROJECT_PRIME_DEFAULTS,
      ),
    ).toMatchObject({ priceRupees: 85, priceType: "rent_per_sqft_month", offerType: "rent" });
  });

  it("gives the card no city, since a project has none", () => {
    expect(toProjectCard(item(), "https://example.supabase.co", PROJECT_PRIME_DEFAULTS).city).toBe(
      "",
    );
  });

  it("marks a project Prime under the admin's current amounts, and not when they are higher (ADR-208)", () => {
    const url = "https://example.supabase.co";
    expect(toProjectCard(item({ price: 15_000_000 }), url, PROJECT_PRIME_DEFAULTS).prime).toBe(
      true,
    );
    expect(toProjectCard(item(), url, PROJECT_PRIME_DEFAULTS).prime).toBe(false);
    expect(
      toProjectCard(item(), url, { ...PROJECT_PRIME_DEFAULTS, totalPrice: 7_000_000 }).prime,
    ).toBe(true);
  });
});
