import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { PROJECT_STATUSES, PROJECTS_TAG, type ProjectStatus } from "@/features/projects";
import { LISTINGS_TAG } from "@/features/search";
import { MAX_TOOL_RESULT_ITEMS } from "@/config/ai";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import {
  BUILDER_COLUMNS,
  BUILDER_DIRECTORY_COLUMNS,
  BUILDER_FIRST_PROJECT_COLUMNS,
  BUILDER_PROJECT_COLUMNS,
  LOCALITY_HOME_COLUMNS,
  LOCALITY_PROJECT_COLUMNS,
} from "./columns";
import { countLocalities, type LocalityCount } from "./localities";

/** PostgREST answers at most this many rows at a time (`max_rows` in the project), so the reads page. */
const PAGE_SIZE = 1000;

/**
 * The most homes and projects whose locality is counted. Above this the counts stop growing and the result
 * says it is not complete. Ten pages of names is the size the search was measured at (S4-SPK-01); a count in
 * the database would need a migration, which this read avoids.
 */
const HOMES_COUNTED_MAX = 10_000;
const PROJECTS_COUNTED_MAX = 1000;

const rowSchema = z.object({ locality: z.string().nullable() });

type Page = { data: unknown; error: { code: string } | null };

/** The localities visitors can find something in, and how true the counts are. */
export type LocalityCounts = {
  /** Busiest first. */
  localities: LocalityCount[];
  /** False when there were more homes or projects than the read counts: the counts are then "at least". */
  complete: boolean;
  /** When the database was read (an ISO date and time). The list is cached for minutes after that. */
  readAt: string;
};

/** Every locality name the pages give, read a page at a time up to `limit` rows. */
async function readNames(
  readPage: (from: number, to: number) => PromiseLike<Page>,
  limit: number,
  source: "homes" | "projects",
): Promise<{ names: string[]; complete: boolean }> {
  const names: string[] = [];
  for (let from = 0; from < limit; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE, limit) - 1;
    const { data, error } = await readPage(from, to);
    if (error) {
      logger.error("localities could not be read", { errorCode: error.code, source });
      throw new Error("localities could not be read");
    }
    const rows = z.array(rowSchema).safeParse(data);
    if (!rows.success) {
      logger.error("locality rows do not fit the expected shape", { source });
      throw new Error("locality rows do not fit the expected shape");
    }
    for (const row of rows.data) {
      if (row.locality !== null) names.push(row.locality);
    }
    if (rows.data.length < to - from + 1) return { names, complete: true };
  }
  return { names, complete: false };
}

/**
 * The localities of every approved home and every live project of an active builder, with how many of each,
 * for the assistant's `list_localities` tool (ADR-128 section 5.1). Read as an anonymous visitor, so the
 * database's own rules decide what exists (BR-90, BR-94), and only the locality is asked for: never an
 * address, a point or an owner. A failed or malformed read throws, so it is never cached. Cached for minutes
 * under the homes tag and the projects tag, so an approval, a sale or a builder change refreshes it.
 */
export async function getLocalityCounts(): Promise<LocalityCounts> {
  "use cache";
  cacheTag(LISTINGS_TAG, PROJECTS_TAG);
  cacheLife("minutes");
  const client = createPublicSupabase();
  const [homes, projects] = await Promise.all([
    readNames(
      (from, to) =>
        client
          .from("properties")
          .select(LOCALITY_HOME_COLUMNS)
          .order("short_id", { ascending: true })
          .range(from, to),
      HOMES_COUNTED_MAX,
      "homes",
    ),
    readNames(
      (from, to) =>
        client
          .from("projects")
          .select(LOCALITY_PROJECT_COLUMNS)
          .order("slug", { ascending: true })
          .range(from, to),
      PROJECTS_COUNTED_MAX,
      "projects",
    ),
  ]);
  return {
    localities: countLocalities(homes.names, projects.names),
    complete: homes.complete && projects.complete,
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

const firstProjectRowSchema = z.object({ created_at: z.string().min(1) });

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

/**
 * A builder's public profile and live projects, read as an anonymous visitor: the five granted builder columns
 * (three are used) and the project columns above, so the database's own rules decide what exists (approved and
 * published projects of an active builder only, BR-42, BR-94). A failed or malformed read throws, so it is never
 * cached. Cached for minutes per builder under the projects tag.
 */
export async function getBuilderProfile(builderId: string): Promise<BuilderProfile> {
  "use cache";
  cacheTag(PROJECTS_TAG);
  cacheLife("minutes");
  const client = createPublicSupabase();
  const readAt = new Date().toISOString();

  const found = await client
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

  const [newest, earliest] = await Promise.all([
    client
      .from("projects")
      .select(BUILDER_PROJECT_COLUMNS, { count: "exact" })
      .eq("builder_id", builderId)
      .order("created_at", { ascending: false })
      .limit(MAX_TOOL_RESULT_ITEMS),
    client
      .from("projects")
      .select(BUILDER_FIRST_PROJECT_COLUMNS)
      .eq("builder_id", builderId)
      .order("created_at", { ascending: true })
      .limit(1),
  ]);
  if (newest.error || earliest.error) {
    logger.error("builder projects could not be read", {
      errorCode: newest.error?.code ?? earliest.error?.code ?? "",
    });
    throw new Error("builder projects could not be read");
  }
  const projectRows = z.array(builderProjectRowSchema).safeParse(newest.data);
  const firstRows = z.array(firstProjectRowSchema).safeParse(earliest.data);
  if (!projectRows.success || !firstRows.success) {
    logger.error("builder project rows do not fit the expected shape", {});
    throw new Error("builder project rows do not fit the expected shape");
  }
  const projects = projectRows.data.map((row): BuilderProject => ({
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
    projectCount: newest.count ?? projects.length,
    firstProjectAt: firstRows.data[0]?.created_at.slice(0, 10) ?? null,
    readAt,
  };
}
