import { describe, expect, it } from "vitest";
import { toProjectEditView, toProjectListRow, type ProjectDbRow } from "../view";

const row = (extra: Partial<ProjectDbRow> = {}): ProjectDbRow => ({
  id: "00000000-0000-4000-a000-000000000001",
  name: "Kadal Vista",
  slug: "kadal-vista",
  builder_id: "00000000-0000-4000-b000-000000000001",
  project_type: "residential",
  property_type: "apartment",
  project_status: "under_construction",
  price_min: 7800000,
  price_max: 14200000,
  bhk_options: [2, 3],
  land_area_acres: "4.50",
  total_units: 320,
  possession_date: "2027-06-30",
  contact_phone: "+919841055512",
  locality: "OMR Navalur",
  address: "Navalur, Chennai",
  latitude: "12.840000",
  longitude: "80.230000",
  advantages: ["Near the IT corridor"],
  nearby: [],
  rera_applicable: true,
  rera_number: "TN/29/Building/0123/2026",
  description: "A gated community.",
  specifications: null,
  amenities: ["Clubhouse"],
  seo_title: null,
  seo_description: null,
  images: ["p/cover.webp"],
  floor_plans: [],
  elevations: [],
  plot_images: [],
  videos: [],
  brochure_path: null,
  form_id: null,
  moderation: "approved",
  published: true,
  featured: false,
  rejection_reason: null,
  ...extra,
});

describe("UT-project-view: the project as the form opens it (S7-T02)", () => {
  it("turns the columns into the form's names and the text numbers into numbers", () => {
    const view = toProjectEditView(row(), []);
    expect(view).toMatchObject({
      name: "Kadal Vista",
      slug: "kadal-vista",
      landAreaAcres: 4.5,
      latitude: 12.84,
      longitude: 80.23,
      priceMin: 7800000,
      bhkOptions: [2, 3],
      images: ["p/cover.webp"],
      brochure: null,
      formId: null,
      moderation: "approved",
      published: true,
    });
  });

  it("keeps a missing number as null, and a number that is not a number as null", () => {
    const view = toProjectEditView(
      row({ land_area_acres: null, latitude: "abc", longitude: null }),
      [],
    );
    expect(view).toMatchObject({ landAreaAcres: null, latitude: null, longitude: null });
  });

  it("shows the price trends by month, oldest first, as year and month", () => {
    const view = toProjectEditView(row(), [
      { month: "2026-10-01", price_per_sqft: 8350 },
      { month: "2026-08-01", price_per_sqft: 8100 },
    ]);
    expect(view.trends).toEqual([
      { month: "2026-08", pricePerSqft: 8100 },
      { month: "2026-10", pricePerSqft: 8350 },
    ]);
  });
});

describe("UT-project-list-row: a project as the builder's list shows it (S7-T03)", () => {
  it("keeps what the list shows and takes the first image as the cover", () => {
    const listed = toProjectListRow(
      row({
        images: ["a/first.jpg", "a/second.jpg"],
        moderation: "approved",
        published: true,
        featured: true,
      }),
    );
    expect(listed).toEqual({
      id: "00000000-0000-4000-a000-000000000001",
      name: "Kadal Vista",
      slug: "kadal-vista",
      locality: "OMR Navalur",
      priceMin: 7800000,
      priceMax: 14200000,
      cover: "a/first.jpg",
      moderation: "approved",
      published: true,
      featured: true,
    });
  });

  it("has no cover for a project without images, and keeps a missing price as none", () => {
    const listed = toProjectListRow(row({ images: [], price_min: null, price_max: null }));
    expect(listed.cover).toBeNull();
    expect(listed.priceMin).toBeNull();
    expect(listed.priceMax).toBeNull();
  });
});
