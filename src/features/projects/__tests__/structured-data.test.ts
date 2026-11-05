import { describe, expect, it, vi } from "vitest";
import type { ProjectData } from "../types";

vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SITE_URL: "https://findsprop.test" },
}));

const { projectStructuredData } = await import("../structured-data");

const project = (overrides: Partial<ProjectData> = {}): ProjectData =>
  ({
    id: "pr1",
    slug: "kadal-vista",
    name: "Kadal Vista",
    developer: { id: "b1", name: "Kadal Homes" },
    status: "under_construction",
    priceMin: 7_800_000,
    priceMax: 14_200_000,
    bhkOptions: [2, 3],
    landAreaAcres: 4.5,
    totalUnits: 120,
    possessionDate: "2028-06-01",
    contactPhone: "+914412345678",
    locality: "OMR Navalur",
    advantages: [],
    nearby: [],
    reraApplicable: true,
    reraNumber: "TN/29/Building/0123/2026",
    description: "A gated community by the sea.\n\nMore about it.",
    specifications: null,
    amenities: ["Pool", "Gym"],
    images: [],
    floorPlans: [],
    videos: [],
    brochurePath: null,
    seoTitle: null,
    seoDescription: null,
    featured: false,
    units: [],
    unitCount: 0,
    availableCount: 0,
    trend: [],
    ...overrides,
  }) as ProjectData;

const images = Array.from(
  { length: 9 },
  (_, index) => `https://x.test/project-media/${index}.webp`,
);
const input = { url: "https://findsprop.test/projects/kadal-vista", images };

describe("UT-project-structured-data: the data of a project", () => {
  it("is an apartment complex with its name, address, description and units", () => {
    expect(projectStructuredData(project(), input)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "ApartmentComplex",
      name: "Kadal Vista",
      url: input.url,
      description: "A gated community by the sea.",
      numberOfAccommodationUnits: 120,
      address: { "@type": "PostalAddress", addressLocality: "OMR Navalur", addressCountry: "IN" },
    });
  });

  it("names its amenities", () => {
    expect(projectStructuredData(project(), input)).toMatchObject({
      amenityFeature: [
        { "@type": "LocationFeatureSpecification", name: "Pool", value: true },
        { "@type": "LocationFeatureSpecification", name: "Gym", value: true },
      ],
    });
  });

  it("names the first six photos only", () => {
    expect(projectStructuredData(project(), input)["image"]).toEqual(images.slice(0, 6));
  });

  it("uses the developer's own search description when there is one", () => {
    expect(
      projectStructuredData(project({ seoDescription: "  Sea-facing homes on OMR.  " }), input),
    ).toMatchObject({ description: "Sea-facing homes on OMR." });
  });

  it("leaves out what the developer did not say", () => {
    const data = projectStructuredData(
      project({ description: null, totalUnits: null, amenities: [] }),
      { url: input.url, images: [] },
    );
    for (const key of ["description", "image", "numberOfAccommodationUnits", "amenityFeature"]) {
      expect(data, key).not.toHaveProperty(key);
    }
    expect(projectStructuredData(project({ totalUnits: 0 }), input)).not.toHaveProperty(
      "numberOfAccommodationUnits",
    );
  });

  it("holds no street address, exact location or contact number", () => {
    const text = JSON.stringify(projectStructuredData(project(), input));
    for (const private_ of [
      "streetAddress",
      "latitude",
      "longitude",
      "geo",
      "telephone",
      "4412345678",
    ]) {
      expect(text, private_).not.toContain(private_);
    }
  });
});
