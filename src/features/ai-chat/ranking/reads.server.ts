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
}

const projectExtrasRowSchema = z.object({
  slug: z.string().min(1),
  amenities: z.array(z.string()).nullable().catch(null),
  created_at: z.string().nullable().catch(null),
  area_min_sqft: z.number().nullable().catch(null),
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
      .select("slug, amenities, created_at, area_min_sqft")
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
      });
    }
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("project amenities could not be read, ranking without them", {});
  }
  return extras;
}
