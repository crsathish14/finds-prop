import type { PropertyType } from "@/config/search-options";

/** One photo of a home: where it is in the public bucket, and the owner's description of it, if any. */
export type PropertyPhoto = { path: string; alt: string | null };

/**
 * One home as the property page holds it: only what a visitor may see, with the names of the page
 * (not the columns') and nothing computed for display. The words and the formatting are the page's.
 */
export type PropertyData = {
  id: string;
  shortId: string;
  slug: string;
  listingType: "sale" | "rent";
  propertyType: PropertyType;
  title: string;
  description: string | null;
  /** Bedrooms; null for a plot or a commercial property, and when the owner did not say. */
  bedrooms: number | null;
  bathrooms: number | null;
  areaSqft: number | null;
  /** Whole rupees: the price for a sale, the rent per month for a rent. */
  price: number;
  furnishing: "unfurnished" | "semi" | "full" | null;
  /** As the owner chose them, free text up to 20 entries. */
  amenities: string[];
  availableFrom: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  featured: boolean;
  /** Featured, Prime or Budget (BR-92), from the database's own `listing_label()`. */
  label: "featured" | "prime" | "budget" | null;
  /** Whole days since it was published, read when the page was made; null when not known. */
  ageDays: number | null;
  /** The cover first, then in the owner's order; at most six. */
  photos: PropertyPhoto[];
};
