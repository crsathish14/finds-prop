import { z } from "zod";

/**
 * One line of the admin's Projects page (S7-T04, FR-ADM-03), ready to draw: the project with its builder's name and
 * how many leads it has (a project with leads cannot be deleted, BR-44).
 */
export interface AdminProjectRow {
  id: string;
  name: string;
  slug: string;
  locality: string;
  priceMin: number | null;
  priceMax: number | null;
  /** The first picture's path in the media bucket, or none. */
  cover: string | null;
  moderation: string;
  published: boolean;
  featured: boolean;
  builderId: string;
  builderName: string;
  leads: number;
}

const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  locality: z.string(),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  cover: z.string().nullable(),
  moderation: z.string(),
  published: z.boolean(),
  featured: z.boolean(),
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
      priceMin: row.price_min,
      priceMax: row.price_max,
      cover: row.cover,
      moderation: row.moderation,
      published: row.published,
      featured: row.featured,
      builderId: row.builder_id,
      builderName: row.builder_name,
      leads: row.leads,
    });
  }
  return { projects, skipped };
}
