import {
  amenityList,
  perSqftRupees,
  placeLine,
  propertyPath,
  type PropertyData,
} from "@/features/property";
import type { CompareColumn } from "./table";

/** The column of a home. The cover's address is built by the caller from public storage. */
export function toCompareColumn(property: PropertyData, cover: string | null): CompareColumn {
  const place = placeLine(property).line;
  return {
    shortId: property.shortId,
    href: propertyPath(property.slug, property.shortId),
    title: property.title,
    listingType: property.listingType,
    price: property.price,
    perSqftRupees: perSqftRupees(property),
    propertyType: property.propertyType,
    place: place === "" ? null : place,
    areaSqft: property.areaSqft !== null && property.areaSqft > 0 ? property.areaSqft : null,
    bedrooms: property.bedrooms !== null && property.bedrooms > 0 ? property.bedrooms : null,
    bathrooms: property.bathrooms,
    furnishing: property.furnishing,
    amenities: amenityList(property.amenities),
    label: property.label,
    cover,
  };
}
