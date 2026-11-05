import { z } from "zod";

/**
 * What the homepage reads from the database, checked as it comes in. A row that does not fit is
 * skipped (and counted in the log), so one odd row never takes a whole section down.
 */

/** One home from `search_properties()`: defined with the search, which reads it too (ADR-042). */
export { listingRowSchema, type ListingRow } from "@/features/search";

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
