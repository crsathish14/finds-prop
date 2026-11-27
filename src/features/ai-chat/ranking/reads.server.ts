import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { PROJECT_PRIME_DEFAULTS, type ProjectPrimeRules } from "@/lib/project-prime";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { NO_PROMOTIONS, type PromotionLists } from "./promotions";

/**
 * The reads of the AI search ranking (ADR-205). Every one is extra to the search itself: when one fails, the search
 * still answers with every match, only ranked without what that read would have added. So none of them throws.
 */

/**
 * The admin's promotion lists, read fresh from the site settings every search (the settings read is cached for minutes
 * under the site-settings tag, which the admin's save refreshes): the Sponsored builders page's two lists, the Top
 * developers page, and the projects an active sponsor ad links to. The site feature is loaded only when this runs.
 */
export async function getPromotionLists(): Promise<PromotionLists> {
  try {
    const { getSiteSettings, getSponsorAds } = await import("@/features/site");
    const [settings, ads] = await Promise.all([getSiteSettings(), getSponsorAds()]);
    return {
      sponsoredBuilders: new Set(settings.sponsored_builders.featured),
      spotlightBuilders: new Set(settings.sponsored_builders.spotlight),
      topBuilders: new Set(settings.top_developers.builderIds),
      sponsoredProjects: new Set(
        ads.flatMap((ad) => (ad.active && ad.projectSlug !== undefined ? [ad.projectSlug] : [])),
      ),
    };
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("promotion lists could not be read, ranking without them", {});
    return NO_PROMOTIONS;
  }
}

/**
 * The super admin's Prime project amounts (ADR-208), read from the site settings like the promotion lists, so a saved
 * change reaches the next search. The settings read already falls back to the built-in amounts when the table cannot
 * be read; anything else failing gives the built-in amounts too, never an error.
 */
export async function getPrimeRules(): Promise<ProjectPrimeRules> {
  try {
    const { getSiteSettings } = await import("@/features/site");
    return (await getSiteSettings()).project_prime;
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("prime amounts could not be read, using the built-in ones", {});
    return PROJECT_PRIME_DEFAULTS;
  }
}

/** A point on the map, in degrees. */
export interface CentrePoint {
  readonly lat: number;
  readonly lng: number;
}

const projectPointSchema = z.object({
  locality: z.string(),
  latitude: z.number().nullable().catch(null),
  longitude: z.number().nullable().catch(null),
});

/** The most projects a centre is worked out from. */
const CENTRE_PROJECTS_MAX = 50;

/** The text of a filter as an `ilike` pattern that matches it literally anywhere. */
function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/**
 * The centre of a locality from what we already hold (ADR-216), never from a paid map lookup: the admin's curated
 * localities first (the homepage list, each with its point), else the mean of the exact points of the live projects in
 * that locality (public columns, read as the signed-in customer). `matches` decides whether a name is the locality, so the
 * caller's spelling-proof rule is used. Null when neither holds one; a failed read is null too, never an error.
 */
export async function getLocalityCentre(
  locality: string,
  matches: (name: string) => boolean,
): Promise<CentrePoint | null> {
  try {
    const { getSiteSettings } = await import("@/features/site");
    const curated = (await getSiteSettings()).homepage.localities.find((place) =>
      matches(place.label),
    );
    if (curated !== undefined) return { lat: curated.lat, lng: curated.lng };
    const { data, error } = await (
      await createServerSupabase()
    )
      .from("projects")
      .select("locality, latitude, longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .ilike("locality", containsPattern(locality.trim()))
      .limit(CENTRE_PROJECTS_MAX);
    if (error) {
      logger.warn("locality centre could not be read", { errorCode: error.code });
      return null;
    }
    const points = (data ?? []).flatMap((row) => {
      const parsed = projectPointSchema.safeParse(row);
      if (!parsed.success || !matches(parsed.data.locality)) return [];
      const { latitude, longitude } = parsed.data;
      return latitude === null || longitude === null ? [] : [{ lat: latitude, lng: longitude }];
    });
    if (points.length === 0) return null;
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    return {
      lat: mean(points.map((point) => point.lat)),
      lng: mean(points.map((point) => point.lng)),
    };
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("locality centre could not be read", {});
    return null;
  }
}

/** What the ranking reads about a home besides its search row. */
export interface HomeExtras {
  readonly amenities: readonly string[];
  readonly furnishing: string | null;
}

const homeExtrasRowSchema = z.object({
  short_id: z.string().min(1),
  amenities: z.array(z.string()).nullable().catch(null),
  furnishing: z.string().nullable().catch(null),
});

/**
 * The amenities and furnishing of the homes a search found, by public id, for the ranking's preferences. Read with the
 * signed-in customer's own session (login wall), approved homes only, and only these two public columns. A home that is
 * not there or does not fit is left out; a failed read gives nothing.
 */
export async function getHomeExtras(shortIds: readonly string[]): Promise<Map<string, HomeExtras>> {
  const extras = new Map<string, HomeExtras>();
  if (shortIds.length === 0) return extras;
  try {
    const { data, error } = await (
      await createServerSupabase()
    )
      .from("properties")
      .select("short_id, amenities, furnishing")
      .eq("status", "approved")
      .in("short_id", [...shortIds]);
    if (error) {
      logger.warn("home amenities could not be read, ranking without them", {
        errorCode: error.code,
      });
      return extras;
    }
    for (const row of data ?? []) {
      const parsed = homeExtrasRowSchema.safeParse(row);
      if (!parsed.success) continue;
      extras.set(parsed.data.short_id, {
        amenities: parsed.data.amenities ?? [],
        furnishing: parsed.data.furnishing,
      });
    }
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("home amenities could not be read, ranking without them", {});
  }
  return extras;
}

/** What the ranking reads about a project besides its list row. */
export interface ProjectExtras {
  readonly amenities: readonly string[];
  readonly createdAt: string | null;
  readonly areaMinSqft: number | null;
  /** Residential or commercial, and the kind of property, for the one list of homes and projects (ADR-215). */
  readonly projectType: string | null;
  readonly propertyType: string | null;
}

const projectExtrasRowSchema = z.object({
  slug: z.string().min(1),
  amenities: z.array(z.string()).nullable().catch(null),
  created_at: z.string().nullable().catch(null),
  area_min_sqft: z.number().nullable().catch(null),
  project_type: z.string().nullable().catch(null),
  property_type: z.string().nullable().catch(null),
});

/**
 * The amenities, listing day and smallest area of the projects a search found, by slug. The slugs come from
 * `live_project_list()`, which gives only live projects of active builders; the read is the signed-in customer's own,
 * of public columns only. A failed read gives nothing.
 */
export async function getProjectExtras(
  slugs: readonly string[],
): Promise<Map<string, ProjectExtras>> {
  const extras = new Map<string, ProjectExtras>();
  if (slugs.length === 0) return extras;
  try {
    const { data, error } = await (
      await createServerSupabase()
    )
      .from("projects")
      .select("slug, amenities, created_at, area_min_sqft, project_type, property_type")
      .in("slug", [...slugs]);
    if (error) {
      logger.warn("project amenities could not be read, ranking without them", {
        errorCode: error.code,
      });
      return extras;
    }
    for (const row of data ?? []) {
      const parsed = projectExtrasRowSchema.safeParse(row);
      if (!parsed.success) continue;
      extras.set(parsed.data.slug, {
        amenities: parsed.data.amenities ?? [],
        createdAt: parsed.data.created_at,
        areaMinSqft: parsed.data.area_min_sqft,
        projectType: parsed.data.project_type,
        propertyType: parsed.data.property_type,
      });
    }
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("project amenities could not be read, ranking without them", {});
  }
  return extras;
}
