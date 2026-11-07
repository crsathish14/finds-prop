import { describe, expect, it } from "vitest";
import { toDraftSummaries, toDraftView } from "../view";

const row = {
  id: "00000000-0000-4000-9000-000000000001",
  short_id: "abcd2345",
  status: "draft",
  listing_type: "sale",
  property_type: "apartment",
  address: "12, Second Cross Street",
  locality: "Velachery",
  city: "Chennai",
  pincode: "600042",
  bhk: 3,
  bathrooms: 2,
  area_sqft: 1420,
  price: 12500000,
  furnishing: "semi",
  amenities: ["Gym", "Lift"],
  title: "3 BHK apartment",
  description: null,
  updated_at: "2026-11-07T10:00:00Z",
};

describe("UT-listings-view: a draft as the wizard reopens it (S6-T02)", () => {
  it("maps a draft row and orders its photos by position", () => {
    const view = toDraftView(row, [
      { id: "p2", storage_path: "u/l/b.jpg", position: 1 },
      { id: "p1", storage_path: "u/l/a.jpg", position: 0 },
    ]);
    expect(view).toMatchObject({
      id: row.id,
      shortId: "abcd2345",
      listingType: "sale",
      propertyType: "apartment",
      areaSqft: 1420,
      price: 12500000,
      furnishing: "semi",
      amenities: ["Gym", "Lift"],
      description: null,
    });
    expect(view?.photos.map((photo) => photo.id)).toEqual(["p1", "p2"]);
  });

  it("reads a value the wizard would not have written as empty", () => {
    const view = toDraftView(
      {
        ...row,
        listing_type: "lease",
        property_type: "castle",
        furnishing: "luxury",
        amenities: ["Gym", "Helipad"],
      },
      [],
    );
    expect(view).toMatchObject({
      listingType: null,
      propertyType: null,
      furnishing: null,
      amenities: ["Gym"],
    });
  });

  it("gives null for something that is not shaped as a listing, and drops photo rows that are not photos", () => {
    expect(toDraftView({ id: 3 }, [])).toBeNull();
    expect(toDraftView(null, [])).toBeNull();
    expect(toDraftView(row, [{ nope: true }, null])?.photos).toEqual([]);
  });

  it("maps the rows of Your drafts and leaves out a broken one", () => {
    const list = toDraftSummaries([
      {
        id: "a",
        title: null,
        locality: "Adyar",
        property_type: "villa",
        listing_type: "rent",
        updated_at: "t",
      },
      { id: 1 },
    ]);
    expect(list).toEqual([
      {
        id: "a",
        title: null,
        locality: "Adyar",
        propertyType: "villa",
        listingType: "rent",
        updatedAt: "t",
      },
    ]);
  });
});
