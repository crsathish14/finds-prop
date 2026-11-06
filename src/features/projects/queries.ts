import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { CACHE_TAGS, projectTag } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import {
  PROJECT_COLUMNS,
  PROJECT_LIST_COLUMNS,
  projectListRowSchema,
  projectRowSchema,
  TREND_COLUMNS,
  trendRowSchema,
  UNIT_COLUMNS,
  unitRowSchema,
  type ProjectListRow,
} from "./schemas";
import type { ProjectData, ProjectListItem, ProjectUnit, TrendPoint } from "./types";
import { orderUnits, trendSeries, TREND_MONTHS, UNITS_SHOWN } from "./view";

/** The cache tag the admin actions refresh when a project is approved, published or changed. */
export const PROJECTS_TAG = CACHE_TAGS.projects;

/** The most projects the list reads. The UX has no paging; this is far above what the site will hold. */
export const PROJECT_LIST_LIMIT = 60;

/**
 * What the projects page shows: the projects, or a failure. A failure carries no detail, since the
 * page only offers "Try again".
 */
export type ProjectList = { status: "ok"; projects: ProjectListItem[] } | { status: "failed" };

/** One project as a visitor may see it, or "missing": no approved, published project has this slug. */
export type ProjectResult = { status: "found"; project: ProjectData } | { status: "missing" };

function toListItem(row: ProjectListRow): ProjectListItem {
  return {
    slug: row.slug,
    name: row.name,
    developerName: row.builders.name,
    status: row.project_status,
    priceMin: row.price_min,
    priceMax: row.price_max,
    bhkOptions: row.bhk_options,
    locality: row.locality,
    coverPath: row.images[0] ?? null,
    featured: row.featured,
  };
}

/**
 * Reads the public projects as an anonymous visitor, so the database's own rules decide what exists:
 * only approved and published projects of active builders, only the granted columns (BR-42, BR-94).
 * Featured first, then the newest. Rows that do not fit are skipped and counted. A failed read is
 * logged by its code only and throws, so it is never cached: "Try again" asks the database again.
 * Cached for minutes under the projects tag.
 */
async function readProjects(): Promise<ProjectListItem[]> {
  "use cache";
  cacheTag(PROJECTS_TAG);
  cacheLife("minutes");
  const { data, error } = await createPublicSupabase()
    .from("projects")
    .select(PROJECT_LIST_COLUMNS)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(PROJECT_LIST_LIMIT);
  if (error) {
    logger.error("projects could not be read", { errorCode: error.code });
    throw new Error("projects could not be read");
  }
  const projects: ProjectListItem[] = [];
  let skipped = 0;
  for (const row of data ?? []) {
    const parsed = projectListRowSchema.safeParse(row);
    if (parsed.success) projects.push(toListItem(parsed.data));
    else skipped += 1;
  }
  if (skipped > 0) {
    logger.warn("projects skipped, they do not match the expected shape", { skipped });
  }
  return projects;
}

/** The public projects, or a failure with no detail (the page offers Try again). */
export async function getProjects(): Promise<ProjectList> {
  try {
    return { status: "ok", projects: await readProjects() };
  } catch (error) {
    // The prerender signal and redirects are Next.js control flow, not failures of the read.
    unstable_rethrow(error);
    return { status: "failed" };
  }
}

/**
 * Reads one project by its slug, as an anonymous visitor, with its first units, the number of units
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

  const found = await client
    .from("projects")
    .select(PROJECT_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (found.error) {
    logger.error("project could not be read", { errorCode: found.error.code });
    throw new Error("project could not be read");
  }
  if (found.data === null) return { status: "missing" };
  const parsed = projectRowSchema.safeParse(found.data);
  if (!parsed.success) {
    logger.error("project row does not fit the expected shape", {});
    throw new Error("project row does not fit the expected shape");
  }
  const row = parsed.data;

  const [units, available, trend] = await Promise.all([
    client
      .from("project_units")
      .select(UNIT_COLUMNS, { count: "exact" })
      .eq("project_id", row.id)
      .order("floor_number", { ascending: true, nullsFirst: false })
      .order("unit_number", { ascending: true })
      .limit(UNITS_SHOWN),
    client
      .from("project_units")
      .select("id", { count: "exact", head: true })
      .eq("project_id", row.id)
      .eq("status", "available"),
    client
      .from("project_price_trends")
      .select(TREND_COLUMNS)
      .eq("project_id", row.id)
      .order("month", { ascending: false })
      .limit(TREND_MONTHS),
  ]);
  if (units.error || available.error || trend.error) {
    logger.error("project units or price trend could not be read", {
      errorCode: units.error?.code ?? available.error?.code ?? trend.error?.code ?? "",
    });
    throw new Error("project units or price trend could not be read");
  }

  const unitRows: ProjectUnit[] = [];
  let skipped = 0;
  for (const item of units.data ?? []) {
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
  for (const item of trend.data ?? []) {
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
      priceMin: row.price_min,
      priceMax: row.price_max,
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
      unitCount: units.count ?? unitRows.length,
      availableCount: available.count ?? 0,
      trend: trendSeries(points),
    },
  };
}
