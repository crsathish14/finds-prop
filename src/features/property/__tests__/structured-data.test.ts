import { describe, expect, it, vi } from "vitest";
import type { PropertyData } from "../types";

vi.mock("@/lib/public-env", () => ({
  publicEnv: { NEXT_PUBLIC_SITE_URL: "https://findsprop.test" },
}));

const { propertyStructuredData } = await import("../structured-data");

const home = (overrides: Partial<PropertyData> = {}): PropertyData => ({
  id: "p1",
  shortId: "k3x9a2bd",
  slug: "3-bhk-apartment-in-velachery",
  listingType: "sale",
  propertyType: "apartment",
  title: "3 BHK apartment in Velachery",
  description: "Bright corner flat near the lake.\n\nSecond paragraph.",
  bedrooms: 3,
  bathrooms: 2,
  areaSqft: 1450,
  price: 9_500_000,
  furnishing: "semi",
  amenities: ["Lift", "Parking"],
  availableFrom: null,
  locality: "Velachery",
  city: "Chennai",
  state: "Tamil Nadu",
  featured: false,
  label: null,
  ageDays: 2,
  publishedAt: "2026-11-01T09:00:00+00:00",
  photos: [],
  ...overrides,
});

const input = {
  url: "https://findsprop.test/properties/3-bhk-apartment-in-velachery-k3x9a2bd",
  images: ["https://example.supabase.co/listing-media/a/1.webp"],
};

describe("UT-property-structured-data: the data of a home", () => {
  it("is a real estate listing with its name, address, description, day posted and photos", () => {
    expect(propertyStructuredData(home(), input)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "RealEstateListing",
      name: "3 BHK apartment in Velachery",
      url: input.url,
      description: "Bright corner flat near the lake.",
      datePosted: "2026-11-01T09:00:00.000Z",
      image: input.images,
    });
  });

  it("offers a sale at its price in rupees", () => {
    expect(propertyStructuredData(home(), input)).toMatchObject({
      offers: {
        "@type": "Offer",
        businessFunction: "https://purl.org/goodrelations/v1#Sell",
        price: 9_500_000,
        priceCurrency: "INR",
      },
    });
  });

  it("offers a rent at its price in rupees per month", () => {
    expect(
      propertyStructuredData(home({ listingType: "rent", price: 32_000 }), input),
    ).toMatchObject({
      offers: {
        businessFunction: "https://purl.org/goodrelations/v1#LeaseOut",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: 32_000,
          priceCurrency: "INR",
          unitCode: "MON",
        },
      },
    });
  });

  it("says what the home is: kind, rooms, size, amenities and the locality, city and state", () => {
    expect(propertyStructuredData(home(), input)).toMatchObject({
      about: {
        "@type": "Apartment",
        numberOfBedrooms: 3,
        numberOfBathroomsTotal: 2,
        floorSize: { "@type": "QuantitativeValue", value: 1450, unitCode: "FTK" },
        amenityFeature: [
          { "@type": "LocationFeatureSpecification", name: "Lift", value: true },
          { "@type": "LocationFeatureSpecification", name: "Parking", value: true },
        ],
        address: {
          "@type": "PostalAddress",
          addressLocality: "Velachery, Chennai",
          addressRegion: "Tamil Nadu",
          addressCountry: "IN",
        },
      },
    });
  });

  it("calls a villa or house a house, and a plot or commercial property a place", () => {
    const kind = (propertyType: PropertyData["propertyType"]) =>
      (propertyStructuredData(home({ propertyType }), input)["about"] as Record<string, unknown>)[
        "@type"
      ];
    expect(kind("villa")).toBe("House");
    expect(kind("house")).toBe("House");
    expect(kind("plot")).toBe("Place");
    expect(kind("commercial")).toBe("Place");
  });

  it("leaves out what the owner did not say instead of writing empty values", () => {
    const data = propertyStructuredData(
      home({
        description: null,
        publishedAt: null,
        bedrooms: null,
        bathrooms: null,
        areaSqft: null,
        amenities: [],
        locality: null,
        city: null,
        state: null,
      }),
      { url: input.url, images: [] },
    );
    expect(data).not.toHaveProperty("description");
    expect(data).not.toHaveProperty("datePosted");
    expect(data).not.toHaveProperty("image");
    expect(data["about"]).toEqual({
      "@type": "Apartment",
      address: { "@type": "PostalAddress", addressCountry: "IN" },
    });
  });

  it("leaves the date out when it does not read as one", () => {
    expect(
      propertyStructuredData(home({ publishedAt: "yesterday-ish" }), input),
    ).not.toHaveProperty("datePosted");
  });

  it("holds no street address, owner or exact location", () => {
    const text = JSON.stringify(propertyStructuredData(home(), input));
    for (const private_ of ["streetAddress", "latitude", "longitude", "geo", "owner", "pincode"]) {
      expect(text, private_).not.toContain(private_);
    }
  });
});
