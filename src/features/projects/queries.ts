import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { CACHE_TAGS, projectTag } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { createServerSupabase } from "@/server/supabase/server";
import { z } from "zod";
import {
  projectListRowSchema,
  projectRowSchema,
  trendRowSchema,
  unitRowSchema,
  type ProjectListRow,
} from "./schemas";
import type { ProjectData, ProjectListItem, ProjectUnit, TrendPoint } from "./types";
import { orderUnits, trendSeries } from "./view";

/**
 * What `public_project()` answers: the project with its builder, its first units, the counts and the
 * latest months of the price trend, as one document. The units and the trend points are checked one by
 * one below, so one that does not fit is skipped, not an error.
 */
const documentSchema = z.object({
  project: z.unknown(),
  units: z.array(z.unknown()),
  unit_count: z.number().int().nonnegative(),
  available_count: z.number().int().nonnegative(),
  trend: z.array(z.unknown()),
});

/** The cache tag the admin actions refresh when a project is approved, published or changed. */
export const PROJECTS_TAG = CACHE_TAGS.projects;

/** The most projects the list reads. The UX has no paging; this is far above what the site will hold. */
export const PROJECT_LIST_LIMIT = 60;

/**
 * What the projects page shows: the projects, or a failure. A failure carries no detail, since the
 * page only offers "Try again". `readAt` is when the database was read (an ISO date and time, taken inside
 * the cached read, so it is the time of the last refill and not the time of the call); the AI assistant
 * quotes it as "as of", and the page ignores it.
 */
export type ProjectList =
  { status: "ok"; projects: ProjectListItem[]; readAt: string } | { status: "failed" };

/**
 * One project as a visitor may see it, or "missing": no approved, published project has this slug.
 * `readAt` is as for the list above.
 */
export type ProjectResult =
  { status: "found"; project: ProjectData; readAt: string } | { status: "missing"; readAt: string };

function toListItem(row: ProjectListRow): ProjectListItem {
  return {
    slug: row.slug,
    name: row.name,
    developerName: row.builders.name,
    status: row.project_status,
    offerType: row.offer_type,
    price: row.price,
    priceType: row.price_type,
    bhkOptions: row.bhk_options,
    locality: row.locality,
    coverPath: row.images[0] ?? null,
    featured: row.featured,
  };
}

/**
 * Reads the public projects for a signed-in visitor through `live_project_list()` (login wall: the list is
 * for signed-in people, and the database refuses anyone else). The function gives only approved and published
 * projects of active builders, only the visitor columns (BR-42, BR-94), featured first, then the newest, the
 * same to everybody, whatever else their own account may read. Rows that do not fit are skipped and counted. A
 * failed read is logged by its code only and throws: "Try again" asks the database again. Not cached: a cache
 * is shared between visitors and this read is one visitor's.
 */
async function readProjects(
  cityKey?: string,
): Promise<{ projects: ProjectListItem[]; readAt: string }> {
  const readAt = new Date().toISOString();
  const { data, error } = await (
    await createServerSupabase()
  ).rpc(
    "live_project_list",
    cityKey ? { p_limit: PROJECT_LIST_LIMIT, p_city: cityKey } : { p_limit: PROJECT_LIST_LIMIT },
  );
  if (error) {
    logger.error("projects could not be read", { errorCode: error.code });
    throw new Error("projects could not be read");
  }
  const projects: ProjectListItem[] = [];
  let skipped = 0;
  for (const row of Array.isArray(data) ? data : []) {
    const parsed = projectListRowSchema.safeParse(row);
    if (parsed.success) projects.push(toListItem(parsed.data));
    else skipped += 1;
  }
  if (skipped > 0) {
    logger.warn("projects skipped, they do not match the expected shape", { skipped });
  }
  return { projects, readAt };
}

/** The public projects (of one city when a key is given), or a failure with no detail (the page offers Try again). */
export async function getProjects(cityKey?: string): Promise<ProjectList> {
  try {
    return { status: "ok", ...(await readProjects(cityKey)) };
  } catch (error) {
    // The prerender signal and redirects are Next.js control flow, not failures of the read.
    unstable_rethrow(error);
    return { status: "failed" };
  }
}

/**
 * Reads one project by its slug through `public_project()`, as an anonymous visitor (the function answers
 * one project or nothing, never a list), with its first units, the number of units
 * and of those available, and the latest months of its price trend. No project is `missing`, which
 * covers one that was never listed, one waiting for review, one not published and one whose builder
 * is not active. Anything else that goes wrong throws (and so is never cached): a failed read must not
 * look like a project that is gone. Errors are logged by their code only. Cached for minutes under
 * the projects tag and the project's own tag, so an approval or an edit refreshes it.
 */
export async function getProject(slug: string): Promise<ProjectResult> {
  "use cache";
  cacheTag(PROJECTS_TAG, projectTag(slug));
  cacheLife("minutes");
  const client = createPublicSupabase();
  const readAt = new Date().toISOString();

  const found = await client.rpc("public_project", { p_slug: slug });
  if (found.error) {
    logger.error("project could not be read", { errorCode: found.error.code });
    throw new Error("project could not be read");
  }
  if (found.data === null) return { status: "missing", readAt };
  const document = documentSchema.safeParse(found.data);
  if (!document.success) {
    logger.error("project row does not fit the expected shape", {});
    throw new Error("project row does not fit the expected shape");
  }
  const parsed = projectRowSchema.safeParse(document.data.project);
  if (!parsed.success) {
    logger.error("project row does not fit the expected shape", {});
    throw new Error("project row does not fit the expected shape");
  }
  const row = parsed.data;
  const units = { data: document.data.units, count: document.data.unit_count };
  const available = { count: document.data.available_count };
  const trend = { data: document.data.trend };

  const unitRows: ProjectUnit[] = [];
  let skipped = 0;
  for (const item of units.data) {
    const unit = unitRowSchema.safeParse(item);
    if (!unit.success) {
      skipped += 1;
      continue;
    }
    unitRows.push({
      number: unit.data.unit_number,
      floor: unit.data.floor_number,
      bhk: unit.data.bhk,
      areaSqft: unit.data.area_sqft,
      facing: unit.data.facing,
      price: unit.data.price,
      status: unit.data.status,
      floorPlanPath: unit.data.floor_plan_path,
    });
  }
  const points: TrendPoint[] = [];
  for (const item of trend.data) {
    const point = trendRowSchema.safeParse(item);
    if (!point.success) {
      skipped += 1;
      continue;
    }
    points.push({ month: point.data.month, pricePerSqft: point.data.price_per_sqft });
  }
  if (skipped > 0) {
    logger.warn("project units or trend skipped, they do not match the expected shape", {
      skipped,
    });
  }

  return {
    status: "found",
    project: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      developer: { id: row.builders.id, name: row.builders.name },
      status: row.project_status,
      propertyType: row.property_type,
      plotStatus: row.plot_status,
      villaType: row.villa_type,
      extraFields: row.extra_fields ?? {},
      offerType: row.offer_type,
      price: row.price,
      priceType: row.price_type,
      areaMinSqft: row.area_min_sqft,
      areaMaxSqft: row.area_max_sqft,
      bhkOptions: row.bhk_options,
      landAreaAcres: row.land_area_acres,
      totalUnits: row.total_units,
      possessionDate: row.possession_date,
      contactPhone: row.contact_phone,
      locality: row.locality,
      advantages: row.advantages,
      nearby: row.nearby,
      reraApplicable: row.rera_applicable,
      reraNumber: row.rera_number,
      reraNotApplicableReason: row.rera_not_applicable_reason,
      description: row.description,
      specifications: row.specifications,
      amenities: row.amenities,
      images: row.images,
      floorPlans: row.floor_plans,
      videos: row.videos,
      brochurePath: row.brochure_path,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      featured: row.featured,
      units: orderUnits(unitRows),
      unitCount: units.count,
      availableCount: available.count,
      trend: trendSeries(points),
    },
    readAt,
  };
}
