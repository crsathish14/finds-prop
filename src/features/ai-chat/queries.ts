import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { PROJECT_STATUSES, PROJECTS_TAG, type ProjectStatus } from "@/features/projects";
import { MAX_TOOL_RESULT_ITEMS } from "@/config/ai";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { createServerSupabase } from "@/server/supabase/server";
import { BUILDER_COLUMNS, BUILDER_DIRECTORY_COLUMNS } from "./columns";
import { countLocalities, type LocalityCount } from "./localities";

/** The localities visitors can find something in, and how true the counts are. */
export type LocalityCounts = {
  /** Busiest first. */
  localities: LocalityCount[];
  /** False when there were more homes or projects than the read counts: the counts are then "at least". */
  complete: boolean;
  /** When the database was read (an ISO date and time). */
  readAt: string;
};

/** What `live_locality_names()` answers: the locality names, and whether each read stopped at its cap. */
const localityDocumentSchema = z.object({
  homes: z.array(z.string()),
  homes_complete: z.boolean(),
  projects: z.array(z.string()),
  projects_complete: z.boolean(),
});

/**
 * The localities of every approved home and every live project of an active builder, with how many of each,
 * for the assistant's `list_localities` tool (ADR-128 section 5.1). Read through `live_locality_names()`, which
 * only a signed-in customer may run (login wall, ADR-171), with the customer's own session and so no shared cache:
 * the function gives only the locality of approved homes and live projects (BR-90, BR-94), never an address, a
 * point or an owner. A failed or malformed read throws. The names are counted here; above the caps (10,000 homes,
 * 1,000 projects) the counts stop growing and the result says it is not complete.
 */
export async function getLocalityCounts(): Promise<LocalityCounts> {
  const { data, error } = await (await createServerSupabase()).rpc("live_locality_names");
  if (error) {
    logger.error("localities could not be read", { errorCode: error.code });
    throw new Error("localities could not be read");
  }
  const document = localityDocumentSchema.safeParse(data);
  if (!document.success) {
    logger.error("locality rows do not fit the expected shape", {});
    throw new Error("locality rows do not fit the expected shape");
  }
  return {
    localities: countLocalities(document.data.homes, document.data.projects),
    complete: document.data.homes_complete && document.data.projects_complete,
    readAt: new Date().toISOString(),
  };
}

/** An active builder as the directory lists them: enough to find one by the name a customer wrote. */
export type BuilderListing = { id: string; name: string };

/** The active builders, by name, and when they were read (as for the localities, taken inside the cache). */
export type BuilderDirectory = { builders: BuilderListing[]; readAt: string };

/** The most builders the directory holds: PostgREST answers at most this many rows, and the site has far fewer. */
const BUILDERS_LISTED_MAX = 1000;

const builderListingSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });

/**
 * The names of the active builders, for `get_builder` to turn "Casagrand" into a builder. Read as an
 * anonymous visitor, so an inactive builder is not there at all (BR-94), and only the id and the name are
 * asked for. A failed or malformed read throws, so it is never cached. Cached for minutes under the projects
 * tag, which a builder change refreshes (`tagsAfterBuilderChange`).
 */
export async function getBuilderDirectory(): Promise<BuilderDirectory> {
  "use cache";
  cacheTag(PROJECTS_TAG);
  cacheLife("minutes");
  const readAt = new Date().toISOString();
  const { data, error } = await createPublicSupabase()
    .from("builders")
    .select(BUILDER_DIRECTORY_COLUMNS)
    .order("name", { ascending: true })
    .limit(BUILDERS_LISTED_MAX);
  if (error) {
    logger.error("builders could not be read", { errorCode: error.code });
    throw new Error("builders could not be read");
  }
  const rows = z.array(builderListingSchema).safeParse(data);
  if (!rows.success) {
    logger.error("builder rows do not fit the expected shape", {});
    throw new Error("builder rows do not fit the expected shape");
  }
  return { builders: rows.data, readAt };
}

const builderRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  website: z.string().nullable(),
  description: z.string().nullable(),
});

const builderProjectRowSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  project_status: z.enum(PROJECT_STATUSES).nullable().catch(null),
  locality: z.string().min(1),
  possession_date: z.string().nullable(),
  rera_applicable: z.boolean(),
  rera_number: z.string().nullable(),
  created_at: z.string().min(1),
});

/** One live project of a builder, with the names of the page and nothing computed for display. */
export type BuilderProject = {
  slug: string;
  name: string;
  status: ProjectStatus | null;
  locality: string;
  /** `YYYY-MM-DD`, as stored. */
  possessionDate: string | null;
  reraApplicable: boolean;
  reraNumber: string | null;
};

/**
 * One active builder with their newest live projects, or "missing": no active builder has this id (which
 * covers a builder who was deactivated, exactly as the project pages treat one). `projectCount` is every live
 * project, `projects` only the newest `MAX_TOOL_RESULT_ITEMS`, and `firstProjectAt` the day the earliest live
 * project was created: a builder's own created-at column is not public, so this is the nearest thing a visitor
 * can see to "first project listed here".
 */
export type BuilderProfile =
  | {
      status: "found";
      builder: { id: string; name: string; website: string | null; description: string | null };
      projects: BuilderProject[];
      projectCount: number;
      /** `YYYY-MM-DD`, or null when the builder has no live project. */
      firstProjectAt: string | null;
      readAt: string;
    }
  | { status: "missing"; readAt: string };

/** What `live_builder_projects()` answers. */
const builderProjectsDocumentSchema = z.object({
  projects: z.array(builderProjectRowSchema),
  project_count: z.number().int().nonnegative(),
  first_project_at: z.string().nullable(),
});

/**
 * A builder's public profile and live projects: the builder's three public columns, and the projects through
 * `live_builder_projects()`, which only a signed-in customer may run (login wall, ADR-171) and which gives only
 * approved, published projects of an active builder (BR-42, BR-94). The customer's own session reads it, so there is no
 * shared cache. A builder who is not active is "missing". A failed or malformed read throws.
 */
export async function getBuilderProfile(builderId: string): Promise<BuilderProfile> {
  const readAt = new Date().toISOString();

  const live = await (
    await createServerSupabase()
  ).rpc("live_builder_projects", { p_builder: builderId, p_limit: MAX_TOOL_RESULT_ITEMS });
  if (live.error) {
    logger.error("builder projects could not be read", { errorCode: live.error.code });
    throw new Error("builder projects could not be read");
  }
  if (live.data === null) return { status: "missing", readAt };
  const document = builderProjectsDocumentSchema.safeParse(live.data);
  if (!document.success) {
    logger.error("builder project rows do not fit the expected shape", {});
    throw new Error("builder project rows do not fit the expected shape");
  }

  const found = await createPublicSupabase()
    .from("builders")
    .select(BUILDER_COLUMNS)
    .eq("id", builderId)
    .maybeSingle();
  if (found.error) {
    logger.error("builder could not be read", { errorCode: found.error.code });
    throw new Error("builder could not be read");
  }
  if (found.data === null) return { status: "missing", readAt };
  const builder = builderRowSchema.safeParse(found.data);
  if (!builder.success) {
    logger.error("builder row does not fit the expected shape", {});
    throw new Error("builder row does not fit the expected shape");
  }

  const projects = document.data.projects.map((row): BuilderProject => ({
    slug: row.slug,
    name: row.name,
    status: row.project_status,
    locality: row.locality,
    possessionDate: row.possession_date,
    reraApplicable: row.rera_applicable,
    reraNumber: row.rera_number,
  }));
  return {
    status: "found",
    builder: builder.data,
    projects,
    projectCount: document.data.project_count,
    firstProjectAt: document.data.first_project_at?.slice(0, 10) ?? null,
    readAt,
  };
}

/**
 * Whether the signed-in caller owns this home (P6-T01, the propose tools). It is a read as the caller, not a cached
 * one: `my_properties()` answers with the caller's own listings from their session, so the person is decided by the
 * database and nothing but the home's public id goes in. A caller who is not signed in owns nothing. A failed read
 * throws: "could not check" must never look like "does not own it". The error is logged by its code only.
 */
export async function ownsHome(shortId: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .rpc("my_properties")
    .select("id")
    .eq("short_id", shortId)
    .limit(1);
  if (error) {
    logger.error("the caller's own homes could not be read", { errorCode: error.code });
    throw new Error("the caller's own homes could not be read");
  }
  return data.length > 0;
}
