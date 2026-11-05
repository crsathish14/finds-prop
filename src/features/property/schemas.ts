import { z } from "zod";
import { PROPERTY_TYPES } from "@/config/search-options";

/**
 * What the property page reads from the database, checked as it comes in. The columns are the ones
 * visitors are granted (never the owner, the address or the exact location). A row that does not fit
 * is an error, not "not found": the page must not tell a visitor that a home that exists is gone.
 */

/** The columns read from `properties`, in one place so the read and the schema cannot drift apart. */
export const PROPERTY_COLUMNS =
  "id, short_id, slug, listing_type, property_type, title, description, bhk, bathrooms, area_sqft, price, furnishing, amenities, available_from, locality, city, state, featured, published_at";

export const propertyRowSchema = z.object({
  id: z.string().min(1),
  short_id: z.string().min(1),
  slug: z.string().min(1),
  listing_type: z.enum(["sale", "rent"]),
  property_type: z.enum(PROPERTY_TYPES),
  title: z.string().min(1),
  description: z.string().nullable(),
  bhk: z.number().nullable(),
  bathrooms: z.number().nullable(),
  area_sqft: z.number().nullable(),
  price: z.number().nonnegative(),
  furnishing: z.enum(["unfurnished", "semi", "full"]).nullable(),
  amenities: z.array(z.string()),
  available_from: z.string().nullable(),
  locality: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  featured: z.boolean(),
  published_at: z.string().nullable(),
});

export type PropertyRow = z.infer<typeof propertyRowSchema>;

/** The columns read from `listing_media`. */
export const PHOTO_COLUMNS = "storage_path, alt_text, position, is_cover";

export const photoRowSchema = z.object({
  storage_path: z.string().min(1),
  alt_text: z.string().nullable(),
  position: z.number(),
  is_cover: z.boolean(),
});

export type PhotoRow = z.infer<typeof photoRowSchema>;

/** The label of a home (BR-92); a value this site does not know is no label. */
export const labelSchema = z.enum(["featured", "prime", "budget"]).nullable().catch(null);
