import { z } from "zod";

/**
 * What the homepage reads from the database, checked as it comes in. A row that does not fit is
 * skipped (and counted in the log), so one odd row never takes a whole section down.
 */

/** One home from `search_properties()`: the public columns only, never the address or the owner. */
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

/** A home as the homepage keeps it: the row, and how many days old it was when it was read. */
export type ListingRow = z.infer<typeof listingRowSchema> & { ageDays: number | null };

/** Only the builder of a public project: enough to rank builders and count their projects. */
export const rankingRowSchema = z.object({ builder_id: z.string().min(1) });

/** A public project with its (active) builder, as the second read returns it. */
export const projectRowSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  builder_id: z.string().min(1),
  images: z.array(z.string()).nullable(),
  builders: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable(),
  }),
});

/** A developer for the "New launches" cards: its facts and its first projects. */
export type DeveloperRow = {
  builderId: string;
  name: string;
  description: string | null;
  projectCount: number;
  projects: { slug: string; name: string; coverPath: string | null }[];
};
