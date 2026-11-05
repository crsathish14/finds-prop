import { describe, expect, it } from "vitest";
import { toProjectCard } from "../cards";
import type { ProjectListItem } from "../types";

const item = (overrides: Partial<ProjectListItem> = {}): ProjectListItem => ({
  slug: "kadal-vista",
  name: "Kadal Vista",
  developerName: "Kadal Homes",
  status: "new_launch",
  priceMin: 7_800_000,
  priceMax: 14_200_000,
  bhkOptions: [2, 3],
  locality: "OMR Navalur",
  coverPath: "kadal/front view.webp",
  featured: true,
  ...overrides,
});

describe("UT-project-cards: a project as the card takes it", () => {
  it("links to the project's page and carries the facts as they are", () => {
    expect(toProjectCard(item(), "https://example.supabase.co")).toMatchObject({
      href: "/projects/kadal-vista",
      name: "Kadal Vista",
      developerName: "Kadal Homes",
      locality: "OMR Navalur",
      minRupees: 7_800_000,
      maxRupees: 14_200_000,
      bedrooms: [2, 3],
      status: "new_launch",
      featured: true,
    });
  });

  it("draws the cover from the public project bucket, each part of the path encoded", () => {
    expect(toProjectCard(item(), "https://example.supabase.co/").cover).toEqual({
      src: "https://example.supabase.co/storage/v1/object/public/project-media/kadal/front%20view.webp",
      alt: "Kadal Vista",
    });
  });

  it("has no cover when the project has no picture", () => {
    expect(
      toProjectCard(item({ coverPath: null }), "https://example.supabase.co").cover,
    ).toBeNull();
  });

  it("gives the card no city, since a project has none", () => {
    expect(toProjectCard(item(), "https://example.supabase.co").city).toBe("");
  });
});
