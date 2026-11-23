import { z } from "zod";

/** One row of `listed_cities()`, checked as it comes in. */
export const cityRowSchema = z.object({
  key: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  listing_count: z.number().int().nonnegative(),
});
