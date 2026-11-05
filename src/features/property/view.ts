import { PROPERTY_TYPES, type PropertyType } from "@/config/search-options";
import { textParagraphs, uniqueTexts } from "@/lib/text";
import type { PropertyData } from "./types";

/**
 * The rules the property page applies between a home and the screen (S4-T03, ADR-043). Pure and
 * word-free: they say what is shown and in what order, and the page turns that into text. Anything
 * the owner did not give is left out, never drawn as a blank or a zero.
 */

/** One entry of "At a glance", in the order of the UX. */
export type SpecItem =
  | { key: "bedrooms"; value: number }
  | { key: "bathrooms"; value: number }
  | { key: "area"; value: number }
  | { key: "propertyType"; value: PropertyType }
  | { key: "furnishing"; value: NonNullable<PropertyData["furnishing"]> }
  | { key: "listed"; value: number };

/**
 * The facts for "At a glance": bedrooms, bathrooms, area, kind of property, furnishing and how long
 * ago it was listed. Bedrooms are left out when there are none to count (a plot, a commercial
 * property, or "0"); the others when not given. The kind of property is always known.
 */
export function specItems(property: PropertyData): SpecItem[] {
  const items: SpecItem[] = [];
  if (property.bedrooms !== null && property.bedrooms > 0) {
    items.push({ key: "bedrooms", value: property.bedrooms });
  }
  if (property.bathrooms !== null) items.push({ key: "bathrooms", value: property.bathrooms });
  if (property.areaSqft !== null && property.areaSqft > 0) {
    items.push({ key: "area", value: property.areaSqft });
  }
  if ((PROPERTY_TYPES as readonly string[]).includes(property.propertyType)) {
    items.push({ key: "propertyType", value: property.propertyType });
  }
  if (property.furnishing !== null) items.push({ key: "furnishing", value: property.furnishing });
  if (property.ageDays !== null) items.push({ key: "listed", value: property.ageDays });
  return items;
}

/**
 * The price per square foot, for a sale only (a rent has none) and only when the area is known and
 * more than nothing. Whole rupees, rounded.
 */
export function perSqftRupees(property: PropertyData): number | undefined {
  if (property.listingType !== "sale") return undefined;
  if (property.areaSqft === null || property.areaSqft <= 0) return undefined;
  return Math.round(property.price / property.areaSqft);
}

/**
 * The description as paragraphs of plain text: a blank line starts a new one, and a single line break
 * stays inside its paragraph. Never HTML: the text is shown as text.
 */
export function descriptionParagraphs(description: string | null): string[] {
  return textParagraphs(description);
}

/** The amenities as the owner wrote them: trimmed, none empty, none twice (capitals ignored), in order. */
export function amenityList(amenities: readonly string[]): string[] {
  return uniqueTexts(amenities);
}

/**
 * True when a detail the UX shows, and the owner may leave out, is missing: bathrooms, furnishing or
 * the amenities. The page then adds its note that such details are left out, not shown as blanks.
 * (The description and the area are required of every listed home, and "available from" is not drawn.)
 */
export function hasLeftOutDetails(property: PropertyData): boolean {
  return (
    property.bathrooms === null ||
    property.furnishing === null ||
    amenityList(property.amenities).length === 0
  );
}

/** The place a home is in, for the breadcrumb and the line under the title: locality, then city. */
export function placeLine(property: PropertyData): { locality: string | null; line: string } {
  const parts = [property.locality, property.city].filter(
    (part): part is string => part !== null && part.trim() !== "",
  );
  return { locality: property.locality, line: parts.join(", ") };
}

/** How long a page description may be before it is cut at a word. */
const DESCRIPTION_LIMIT = 155;

/**
 * The description for the page's metadata: the first paragraph, cut at a whole word with an ellipsis
 * when it is long; null when the home has no description.
 */
export function metaDescription(property: PropertyData): string | null {
  const first = descriptionParagraphs(property.description)[0];
  if (first === undefined) return null;
  const flat = first.replace(/\s+/g, " ");
  if (flat.length <= DESCRIPTION_LIMIT) return flat;
  const cut = flat.slice(0, DESCRIPTION_LIMIT);
  const space = cut.lastIndexOf(" ");
  return `${(space > 40 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
