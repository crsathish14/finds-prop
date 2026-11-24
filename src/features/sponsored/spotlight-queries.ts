import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import type { DeveloperSpotlightData } from "@/components/domain/developer-spotlight";
import { getSiteSettings } from "@/features/site";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { publicEnv } from "@/lib/public-env";
import { SPONSORED_BUILDERS_MAX } from "@/lib/sponsored-builders";
import { BUILDER_LOGO_BUCKET, PROJECT_BUCKET, publicStorageUrl } from "@/lib/storage-url";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import {
  pickSpotlight,
  spotlightAbout,
  spotlightCandidates,
  SPOTLIGHT_PROJECTS,
  SPOTLIGHT_PROJECTS_READ,
  yearsSince,
  type SpotlightCandidate,
} from "./spotlight";

/** The public projects of the home page, as `home_developers()` gives them: only the slug and the builder count here. */
const rowSchema = z.object({ slug: z.string().min(1), builder_id: z.string().min(1) });

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
  price: z.number().nullable().catch(null),
  price_type: z.enum(PRICE_TYPES).nullable().catch(null),
  project_status: z.enum(STATUSES).nullable().catch(null),
  images: z.array(z.string()).nullable().catch([]),
});

const documentSchema = z.object({ project: projectSchema });

const builderSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().catch(null),
  website: z.string().nullable().catch(null),
  logo_url: z.string().nullable().catch(null),
  logo_path: z.string().nullable().catch(null),
  tagline: z.string().nullable().catch(null),
  established_year: z.number().nullable().catch(null),
  projects_delivered: z.number().nullable().catch(null),
});

/** What the spotlight needs of one builder, the same for every visit (cached); the years are worked out per visit. */
type SpotlightDetails = Omit<DeveloperSpotlightData, "years"> & { startedYear: number | null };

/** Only a web address is linked: anything else the builder typed is left out. */
function webAddress(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * The builders the admin picked for the spotlight that have a live project in the city (all cities without one), in
 * the order picked, with their projects' slugs. One read of `home_developers()` as an anonymous visitor (approved,
 * published projects of active builders only, featured first and then the newest), cached for minutes and refreshed
 * with the homepage's developers. A failed read is logged by its code and gives nobody.
 */
async function readCandidates(
  picked: readonly string[],
  cityKey: string | undefined,
): Promise<SpotlightCandidate[]> {
  "use cache";
  cacheTag(CACHE_TAGS.homeProjects);
  cacheLife("minutes");
  const { data, error } = await createPublicSupabase().rpc(
    "home_developers",
    cityKey ? { p_city: cityKey } : {},
  );
  if (error) {
    logger.error("the developer spotlight could not be read", { errorCode: error.code });
    return [];
  }
  const rows = (Array.isArray(data) ? data : []).flatMap((row) => {
    const parsed = rowSchema.safeParse(row);
    return parsed.success ? [{ builderId: parsed.data.builder_id, slug: parsed.data.slug }] : [];
  });
  return spotlightCandidates(rows, picked);
}

/**
 * One builder's spotlight: their public details (the anonymous visitor's columns of an active builder) and their live
 * projects through the public projection (`public_project()`, the first of them only, enough to count the launching
 * ones and show three). Cached for minutes per builder and refreshed when a builder or a project changes. A builder
 * that cannot be read gives null; a project that cannot be read is left out.
 */
async function readDetails(
  builderId: string,
  slugs: readonly string[],
): Promise<SpotlightDetails | null> {
  "use cache";
  cacheTag(CACHE_TAGS.homeProjects);
  cacheLife("minutes");
  const supabase = createPublicSupabase();
  const builderRead = await supabase
    .from("builders")
    .select(
      "name, description, website, logo_url, logo_path, tagline, established_year, projects_delivered",
    )
    .eq("id", builderId)
    .maybeSingle();
  if (builderRead.error) {
    logger.error("the spotlight developer could not be read", {
      errorCode: builderRead.error.code,
    });
    return null;
  }
  const builder = builderSchema.safeParse(builderRead.data);
  if (!builder.success) return null;

  const reads = await Promise.all(
    slugs
      .slice(0, SPOTLIGHT_PROJECTS_READ)
      .map((slug) => supabase.rpc("public_project", { p_slug: slug })),
  );
  const projects = reads.flatMap((read) => {
    const document = documentSchema.safeParse(read.data);
    return !read.error && document.success ? [document.data.project] : [];
  });

  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const details = builder.data;
  return {
    name: details.name,
    logo: details.logo_path
      ? publicStorageUrl(supabaseUrl, BUILDER_LOGO_BUCKET, details.logo_path)
      : details.logo_url,
    about: spotlightAbout(details.tagline, details.description),
    startedYear: details.established_year,
    delivered: details.projects_delivered,
    listed: slugs.length,
    launching: projects.filter((project) => project.project_status === "new_launch").length,
    website: webAddress(details.website),
    projects: projects.slice(0, SPOTLIGHT_PROJECTS).map((project) => {
      const cover = project.images?.[0];
      return {
        href: `/projects/${project.slug}`,
        name: project.name,
        locality: project.locality,
        bedrooms: project.bhk_options ?? [],
        priceRupees: project.price,
        priceType: project.price_type,
        status: project.project_status,
        cover: cover ? publicStorageUrl(supabaseUrl, PROJECT_BUCKET, cover) : null,
      };
    }),
  };
}

/**
 * The developer the spotlight shows on this visit (ADR-193), or null when there is none to show. Among the builders
 * and agents the admin picked (`sponsored_builders.spotlight`) that have a live project in the city, one is picked by
 * chance for each visit (with one, that one), and drawn from what they uploaded. With nobody picked nothing is read. A
 * failed read is logged and gives null, so the home page is never broken by the spotlight.
 */
export async function getSpotlight(cityKey?: string): Promise<DeveloperSpotlightData | null> {
  try {
    const settings = await getSiteSettings();
    const picked = settings.sponsored_builders.spotlight.slice(0, SPONSORED_BUILDERS_MAX);
    if (picked.length === 0) return null;
    const candidates = await readCandidates(picked, cityKey);
    // A different developer on each visit: the chance is read for the request, not stored with the page.
    await connection();
    const chosen = pickSpotlight(candidates, Math.random);
    if (!chosen) return null;
    const details = await readDetails(chosen.builderId, chosen.slugs);
    if (!details) return null;
    const { startedYear, ...shown } = details;
    return { ...shown, years: yearsSince(startedYear, new Date().getFullYear()) };
  } catch (error) {
    unstable_rethrow(error);
    logger.error("the developer spotlight could not be read", {});
    return null;
  }
}
