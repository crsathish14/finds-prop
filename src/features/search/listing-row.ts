import { z } from "zod";

/**
 * One home from `search_properties()`, checked as it comes in: the public columns only, never the
 * address or the owner. The results page and the homepage both read homes through that function, so
 * the row and the cache tag live here and the homepage uses them from this feature (ADR-042).
 * A row that does not fit is skipped and counted by the reader, so one odd row never takes a list down.
 */
export const listingRowSchema = z.object({
  short_id: z.string().min(1),
  slug: z.string().min(1),
  listing_type: z.enum(["sale", "rent"]),
  property_type: z.string(),
  title: z.string().min(1),
  bhk: z.number().nullable(),
  bathrooms: z.number().nullable(),
  area_sqft: z.number().nullable(),
  price: z.number().nonnegative(),
  locality: z.string().nullable(),
  city: z.string().nullable(),
  // A label this site does not know is no label, not a broken row.
  label: z.enum(["featured", "prime", "budget"]).nullable().catch(null),
  published_at: z.string().nullable(),
  cover_path: z.string().nullable(),
  cover_alt: z.string().nullable(),
});

/** A home as the readers keep it: the row, and how many days old it was when it was read. */
export type ListingRow = z.infer<typeof listingRowSchema> & { ageDays: number | null };

/**
 * The cache tag of every list of homes (the homepage sections and the results page). The admin
 * actions refresh it when a listing is approved or changed. Its value is kept from the first
 * version, which was the homepage's.
 */
export const LISTINGS_TAG = "home-listings";
