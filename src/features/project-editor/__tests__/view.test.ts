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
  offer_type: null,
  plot_status: null,
  villa_type: null,
  price: 7800000,
  price_type: "basic",
  area_min_sqft: null,
  area_max_sqft: null,
  bhk_options: [2, 3],
  land_area_acres: "4.50",
  possession_date: "2027-06-01",
  contact_phone: "+919841055512",
  city: "Chennai",
  locality: "OMR Navalur",
  address: "Navalur, Chennai",
  latitude: "12.840000",
  longitude: "80.230000",
  advantages: ["Near the IT corridor"],
  nearby: [],
  rera_applicable: true,
  rera_number: "TN/29/Building/0123/2026",
  rera_not_applicable_reason: null,
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
      price: 7800000,
      priceType: "basic",
      offerType: null,
      plotStatus: null,
      villaType: null,
      possessionDate: "2027-06-01",
      reraNotApplicableReason: null,
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

  it("carries the area range as numbers, the sale or rent choice and the reason RERA does not apply", () => {
    const view = toProjectEditView(
      row({
        project_type: "commercial",
        property_type: "office",
        offer_type: "rent",
        price_type: "rent_per_sqft_month",
        area_min_sqft: "500.00",
        area_max_sqft: 2500,
        rera_applicable: false,
        rera_number: null,
        rera_not_applicable_reason: "Below the size that needs registration.",
      }),
      [],
    );
    expect(view).toMatchObject({
      offerType: "rent",
      priceType: "rent_per_sqft_month",
      areaMinSqft: 500,
      areaMaxSqft: 2500,
      reraApplicable: false,
      reraNotApplicableReason: "Below the size that needs registration.",
    });
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
      price: 7800000,
      priceType: "basic",
      cover: "a/first.jpg",
      moderation: "approved",
      published: true,
      featured: true,
    });
  });

  it("has no cover for a project without images, and keeps a missing price as none", () => {
    const listed = toProjectListRow(row({ images: [], price: null, price_type: null }));
    expect(listed.cover).toBeNull();
    expect(listed.price).toBeNull();
    expect(listed.priceType).toBeNull();
  });
});
