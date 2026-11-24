import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { getSiteSettings } from "@/features/site";
import { publicEnv } from "@/lib/public-env";
import { BUILDER_LOGO_BUCKET, PROJECT_BUCKET, publicStorageUrl } from "@/lib/storage-url";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { pickFeatured } from "./pick";
import type { FeaturedProjectData } from "./types";

/** As many live projects as the list function gives in one call: the candidates are filtered from these. */
const CANDIDATE_LIMIT = 120;

const listRowSchema = z.object({
  slug: z.string(),
  locality: z.string(),
  builders: z.object({ id: z.string() }),
});

const PRICE_TYPES = [
  "per_sqft",
  "basic",
  "all_inclusive",
  "rent_per_month",
  "rent_per_sqft_month",
] as const;
const STATUSES = ["new_launch", "under_construction", "ready_to_move"] as const;

const projectSchema = z.object({
  slug: z.string(),
  name: z.string(),
  locality: z.string(),
  bhk_options: z.array(z.number()).nullable().catch([]),
  area_min_sqft: z.number().nullable().catch(null),
  area_max_sqft: z.number().nullable().catch(null),
  price: z.number().nullable().catch(null),
  price_type: z.enum(PRICE_TYPES).nullable().catch(null),
  project_status: z.enum(STATUSES).nullable().catch(null),
  possession_date: z.string().nullable().catch(null),
  rera_number: z.string().nullable().catch(null),
  amenities: z.array(z.string()).nullable().catch([]),
  images: z.array(z.string()).nullable().catch([]),
  builders: z.object({ id: z.string(), name: z.string() }),
});

const documentSchema = z.object({ project: projectSchema });

const logoSchema = z.object({
  logo_path: z.string().nullable(),
  logo_url: z.string().nullable(),
});

/**
 * The sponsored project the Featured card shows (ADR-192), or null when there is none to show. It reads, as the
 * signed-in visitor (the lists are behind the login wall), the live projects of the selected city, keeps those of the
 * builders and agents the admin picked (`sponsored_builders.featured`), picks one (the searched area first, a
 * different one on each visit) and reads that project's details through the public projection. Only approved,
 * published projects of active builders can show: both functions give nothing else. A failed read is logged by its
 * code and gives null, so the results page is never broken by the card.
 */
export async function getFeaturedProject({
  cityKey,
  area,
}: {
  cityKey?: string | undefined;
  area?: string | undefined;
}): Promise<FeaturedProjectData | null> {
  try {
    const settings = await getSiteSettings();
    const picked = new Set(settings.sponsored_builders.featured);
    if (picked.size === 0) return null;

    const supabase = await createServerSupabase();
    const list = await supabase.rpc(
      "live_project_list",
      cityKey ? { p_limit: CANDIDATE_LIMIT, p_city: cityKey } : { p_limit: CANDIDATE_LIMIT },
    );
    if (list.error) {
      logger.error("the featured projects could not be read", { errorCode: list.error.code });
      return null;
    }
    const candidates = (Array.isArray(list.data) ? list.data : []).flatMap((row) => {
      const parsed = listRowSchema.safeParse(row);
      return parsed.success && picked.has(parsed.data.builders.id) ? [parsed.data] : [];
    });
    // A different project on each visit: the page is read for each request, so the chance is the visit's own.
    const chosen = pickFeatured(candidates, area, Math.random);
    if (!chosen) return null;

    const found = await supabase.rpc("public_project", { p_slug: chosen.slug });
    if (found.error) {
      logger.error("the featured project could not be read", { errorCode: found.error.code });
      return null;
    }
    const document = documentSchema.safeParse(found.data);
    if (!document.success) return null;
    const project = document.data.project;

    const logoRow = await supabase
      .from("builders")
      .select("logo_path, logo_url")
      .eq("id", project.builders.id)
      .maybeSingle();
    const logo = logoSchema.safeParse(logoRow.data);
    const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
    const developerLogo =
      logo.success && logo.data.logo_path
        ? publicStorageUrl(supabaseUrl, BUILDER_LOGO_BUCKET, logo.data.logo_path)
        : logo.success
          ? logo.data.logo_url
          : null;

    const images = project.images ?? [];
    return {
      builderId: project.builders.id,
      href: `/projects/${project.slug}`,
      name: project.name,
      developerName: project.builders.name,
      developerLogo,
      locality: project.locality,
      bedrooms: project.bhk_options ?? [],
      areaMinSqft: project.area_min_sqft,
      areaMaxSqft: project.area_max_sqft,
      priceRupees: project.price,
      priceType: project.price_type,
      status: project.project_status,
      possession: project.possession_date,
      rera: Boolean(project.rera_number?.trim()),
      highlights: (project.amenities ?? []).slice(0, 3),
      photos: images.slice(0, 3).map((path) => publicStorageUrl(supabaseUrl, PROJECT_BUCKET, path)),
      photoCount: images.length,
    };
  } catch (error) {
    unstable_rethrow(error);
    logger.error("the featured project could not be read", {});
    return null;
  }
}
