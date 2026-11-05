import { z } from "zod";

/**
 * What the projects pages read from the database, checked as it comes in. The columns are the ones
 * visitors are granted (never the moderation columns or the form link), and only the ones a page
 * draws. A row that does not fit is an error, not "not found": a page must not tell a visitor that a
 * project that exists is gone.
 */

export const PROJECT_STATUSES = ["new_launch", "under_construction", "ready_to_move"] as const;

/** A status this site does not know is no status (the card then draws no tag). */
const statusSchema = z.enum(PROJECT_STATUSES).nullable().catch(null);

const developerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

/**
 * The columns the list reads. `builders!inner` keeps only projects whose builder is active (an
 * inactive builder is not visible to visitors at all, BR-94), and gives the developer's name.
 */
export const PROJECT_LIST_COLUMNS =
  "slug, name, project_status, price_min, price_max, bhk_options, locality, images, featured, builders!inner(id, name)";

export const projectListRowSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  project_status: statusSchema,
  price_min: z.number().nonnegative().nullable(),
  price_max: z.number().nonnegative().nullable(),
  bhk_options: z.array(z.number().int()),
  locality: z.string().min(1),
  images: z.array(z.string()),
  featured: z.boolean(),
  builders: developerSchema,
});

export type ProjectListRow = z.infer<typeof projectListRowSchema>;

/** The columns the project page reads from `projects`. */
export const PROJECT_COLUMNS =
  "id, slug, name, project_status, price_min, price_max, bhk_options, land_area_acres, total_units, possession_date, contact_phone, locality, advantages, nearby, rera_applicable, rera_number, description, specifications, amenities, images, floor_plans, videos, brochure_path, seo_title, seo_description, featured, builders!inner(id, name)";

export const projectRowSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  project_status: statusSchema,
  price_min: z.number().nonnegative().nullable(),
  price_max: z.number().nonnegative().nullable(),
  bhk_options: z.array(z.number().int()),
  land_area_acres: z.number().nonnegative().nullable(),
  total_units: z.number().int().nonnegative().nullable(),
  possession_date: z.string().nullable(),
  contact_phone: z.string().nullable(),
  locality: z.string().min(1),
  advantages: z.array(z.string()),
  nearby: z.array(z.string()),
  rera_applicable: z.boolean(),
  rera_number: z.string().nullable(),
  description: z.string().nullable(),
  specifications: z.string().nullable(),
  amenities: z.array(z.string()),
  images: z.array(z.string()),
  floor_plans: z.array(z.string()),
  videos: z.array(z.string()),
  brochure_path: z.string().nullable(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  featured: z.boolean(),
  builders: developerSchema,
});

export type ProjectRow = z.infer<typeof projectRowSchema>;

/** The columns read from `project_units`. */
export const UNIT_COLUMNS =
  "unit_number, floor_number, bhk, area_sqft, facing, price, status, floor_plan_path";

export const UNIT_STATUSES = ["available", "hold", "sold", "blocked"] as const;

export const unitRowSchema = z.object({
  unit_number: z.string().min(1),
  floor_number: z.number().int().nullable(),
  bhk: z.number().int().nullable(),
  area_sqft: z.number().nonnegative().nullable(),
  facing: z.string().nullable(),
  price: z.number().nonnegative().nullable(),
  status: z.enum(UNIT_STATUSES),
  floor_plan_path: z.string().nullable(),
});

export type UnitRow = z.infer<typeof unitRowSchema>;

/** The columns read from `project_price_trends`. */
export const TREND_COLUMNS = "month, price_per_sqft";

export const trendRowSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price_per_sqft: z.number().int().positive(),
});

export type TrendRow = z.infer<typeof trendRowSchema>;
