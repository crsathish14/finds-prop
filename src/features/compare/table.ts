import type { PropertyType } from "@/config/search-options";

/**
 * What the comparison table shows and the rules for its rows (S4-T02, ADR-044). Pure, with no server
 * code, so the table can be drawn in the browser and in the Design Lab.
 */

/**
 * One home as a column of the comparison (S4-T02, ADR-044): what the table shows, already reduced to
 * plain values. The table draws it and holds nothing else, so the Design Lab can show the comparison
 * with sample columns. Built on the server from the home the property read gives.
 */
export type CompareColumn = {
  shortId: string;
  href: string;
  title: string;
  listingType: "sale" | "rent";
  /** Whole rupees: the price, or the rent per month. */
  price: number;
  /** For a sale with a known area only; otherwise the row says "Not applicable". */
  perSqftRupees: number | undefined;
  propertyType: PropertyType;
  /** "Velachery, Chennai"; null when the home has no place. */
  place: string | null;
  areaSqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: "unfurnished" | "semi" | "full" | null;
  amenities: string[];
  label: "featured" | "prime" | "budget" | null;
  /** The cover picture's address, or null when the home has none. */
  cover: string | null;
};

/**
 * Every amenity any of the homes has, in the order they first appear, once each (capitals ignored; the
 * first spelling is shown). Each is a row of the table, with Yes or Not listed in every column.
 */
export function amenityRows(columns: readonly CompareColumn[]): string[] {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const column of columns) {
    for (const amenity of column.amenities) {
      const key = amenity.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(amenity);
    }
  }
  return rows;
}

/** True when this column has the amenity (capitals ignored). */
export function hasAmenity(column: CompareColumn, amenity: string): boolean {
  const key = amenity.toLowerCase();
  return column.amenities.some((own) => own.toLowerCase() === key);
}
