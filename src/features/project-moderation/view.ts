import { z } from "zod";
import { hasFeaturedDays } from "@/lib/promotion-dates";

/**
 * One line of the admin's Projects page (S7-T04, FR-ADM-03), ready to draw: the project with its builder's name and
 * how many leads it has (a project with leads cannot be deleted, BR-44).
 */
export interface AdminProjectRow {
  id: string;
  name: string;
  slug: string;
  locality: string;
  /** Whole rupees: the one price, and what it means (per sq ft, basic, all inclusive, rent). */
  price: number | null;
  priceType: string | null;
  /** The first picture's path in the media bucket, or none. */
  cover: string | null;
  moderation: string;
  published: boolean;
  featured: boolean;
  /** The first and last day of its Featured (ADR-210), `YYYY-MM-DD`, or null for none. */
  featuredFrom: string | null;
  featuredUntil: string | null;
  builderId: string;
  builderName: string;
  leads: number;
}

const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  locality: z.string(),
  price: z.number().nullable(),
  price_type: z.string().nullable(),
  cover: z.string().nullable(),
  moderation: z.string(),
  published: z.boolean(),
  featured: z.boolean(),
  // Optional so a database without the dates yet (ADR-210) still shows the list.
  featured_from: z.string().nullable().optional(),
  featured_until: z.string().nullable().optional(),
  builder_id: z.string(),
  builder_name: z.string(),
  leads: z.number().int().min(0),
});

/**
 * The rows from `admin_project_overview()`. A row that is not in the expected shape is left out and counted, so one
 * bad row does not take the whole page down, and the caller can log it.
 */
export function toAdminProjectRows(rows: readonly unknown[] | null): {
  projects: AdminProjectRow[];
  skipped: number;
} {
  const projects: AdminProjectRow[] = [];
  let skipped = 0;
  for (const raw of rows ?? []) {
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const row = parsed.data;
    projects.push({
      id: row.id,
      name: row.name,
      slug: row.slug,
      locality: row.locality,
      price: row.price,
      priceType: row.price_type,
      cover: row.cover,
      moderation: row.moderation,
      published: row.published,
      featured: row.featured,
      featuredFrom: row.featured_from ?? null,
      featuredUntil: row.featured_until ?? null,
      builderId: row.builder_id,
      builderName: row.builder_name,
      leads: row.leads,
    });
  }
  return { projects, skipped };
}

/**
 * The Feature choices in a project's More menu (ADR-210). Only an approved project can be featured. One whose Featured
 * has dates (scheduled, running or ended) offers both: Feature to change the dates, and Remove from featured, which
 * also clears them; otherwise the one that fits its switch, as before.
 */
export function featureChoices(
  row: Pick<AdminProjectRow, "moderation" | "featured" | "featuredFrom" | "featuredUntil">,
): ("feature" | "unfeature")[] {
  if (row.moderation !== "approved") return [];
  if (hasFeaturedDays(row)) return ["feature", "unfeature"];
  return [row.featured ? "unfeature" : "feature"];
}
