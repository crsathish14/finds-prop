import type { PropertyType } from "@/config/search-options";
import { compact, JSON_LD_CONTEXT, postalAddress, type JsonLdDocument } from "@/features/seo";
import type { PropertyData } from "./types";
import { metaDescription } from "./view";

/** The schema.org kind of place for each kind of property. A plot or a commercial property is a plain place. */
const ABOUT_TYPE = {
  apartment: "Apartment",
  villa: "House",
  house: "House",
  plot: "Place",
  commercial: "Place",
} as const satisfies Record<PropertyType, string>;

/** What the offer is, in the vocabulary search engines read (GoodRelations, as schema.org does). */
const SELL = "https://purl.org/goodrelations/v1#Sell";
const LEASE_OUT = "https://purl.org/goodrelations/v1#LeaseOut";

/** Square feet, and per month, as their UN/CEFACT codes. */
const SQUARE_FEET = "FTK";
const PER_MONTH = "MON";

/** The day or time a home was published, written as an ISO date and time, or nothing when it is unknown. */
function postedAt(publishedAt: string | null): string | null {
  if (publishedAt === null) return null;
  const date = new Date(publishedAt);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function offer(property: PropertyData): JsonLdDocument {
  if (property.listingType === "rent") {
    return {
      "@type": "Offer",
      businessFunction: LEASE_OUT,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: property.price,
        priceCurrency: "INR",
        unitCode: PER_MONTH,
      },
    };
  }
  return { "@type": "Offer", businessFunction: SELL, price: property.price, priceCurrency: "INR" };
}

/**
 * The structured data of a home's page (FR-PUB-14): a `RealEstateListing` with its price in rupees
 * (per month for a rent), the day it was published, its photos, and what it is: kind, bedrooms,
 * bathrooms, size, amenities and place. The place is the locality, city and state; there is no street
 * address or exact location, here or in the page (BR-90). Empty values are left out.
 */
export function propertyStructuredData(
  property: PropertyData,
  input: { url: string; images: readonly string[] },
): JsonLdDocument {
  return {
    "@context": JSON_LD_CONTEXT,
    "@type": "RealEstateListing",
    ...compact({
      name: property.title,
      url: input.url,
      description: metaDescription(property),
      datePosted: postedAt(property.publishedAt),
      image: [...input.images],
    }),
    offers: offer(property),
    about: {
      "@type": ABOUT_TYPE[property.propertyType],
      ...compact({
        numberOfBedrooms: property.bedrooms,
        numberOfBathroomsTotal: property.bathrooms,
        floorSize:
          property.areaSqft === null
            ? null
            : { "@type": "QuantitativeValue", value: property.areaSqft, unitCode: SQUARE_FEET },
        amenityFeature: property.amenities.map((name) => ({
          "@type": "LocationFeatureSpecification",
          name,
          value: true,
        })),
      }),
      address: postalAddress({
        locality: property.locality,
        city: property.city,
        state: property.state,
      }),
    },
  };
}
