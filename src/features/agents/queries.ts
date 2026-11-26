import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { parseProjectListItems, type ProjectListItem } from "@/features/projects";
import { listingRowSchema, type ListingRow } from "@/features/search";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { agentRowSchema, type AgentRow } from "./schemas";

/** At most this many agents on the home page. */
export const HOME_AGENTS_MAX = 12;

function parseRows(data: unknown, section: string): AgentRow[] {
  const rows: unknown[] = Array.isArray(data) ? data : [];
  const agents: AgentRow[] = [];
  let skipped = 0;
  for (const row of rows) {
    const parsed = agentRowSchema.safeParse(row);
    if (parsed.success) agents.push(parsed.data);
    else skipped += 1;
  }
  if (skipped > 0) {
    logger.warn("agents skipped, they do not match the expected shape", { section, skipped });
  }
  return agents;
}

/**
 * The agents for the home page: active agents with something live, the most listings first. One read of
 * `public_agents()` as an anonymous visitor (name, tagline, picture, year started, live listing count and the commonest
 * localities; never a phone or an email), cached for minutes and refreshed with the home page's listings and projects. A
 * failed read is logged by its code only and the section is left out.
 */
export async function getHomeAgents(): Promise<AgentRow[]> {
  "use cache";
  cacheTag(CACHE_TAGS.listings, CACHE_TAGS.homeProjects);
  cacheLife("minutes");
  const { data, error } = await createPublicSupabase().rpc("public_agents", {
    p_limit: HOME_AGENTS_MAX,
  });
  if (error) {
    logger.error("homepage agents could not be read, the section is left out", {
      errorCode: error.code,
    });
    return [];
  }
  return parseRows(data, "home");
}

/** One agent's page data, or null when the id is no active agent (or the read failed, which is logged by its code). */
export async function getAgent(id: string): Promise<AgentRow | null> {
  "use cache";
  cacheTag(CACHE_TAGS.listings, CACHE_TAGS.homeProjects);
  cacheLife("minutes");
  const { data, error } = await createPublicSupabase().rpc("public_agents", { p_id: id });
  if (error) {
    logger.error("an agent could not be read", { errorCode: error.code });
    return null;
  }
  return parseRows(data, "agent")[0] ?? null;
}

/** How many homes and how many projects an agent's page shows (owner decision, 26 Nov 2026). */
export const AGENT_LISTINGS_MAX = 6;

const MS_PER_DAY = 86_400_000;

/** What an agent's page shows of their listings: up to six homes and six projects, as the cards take them. */
export type AgentListings = { homes: ListingRow[]; projects: ProjectListItem[] };

const listingsSchema = z.object({ homes: z.array(z.unknown()), projects: z.array(z.unknown()) });

/**
 * One agent's newest approved homes and live projects through `agent_listings()` as an anonymous visitor: six of each at
 * most, a small fixed set that gives no phone or email. Cached for minutes and refreshed with the listings and the projects.
 * A failed read is logged by its code only and gives no listings, so the page still shows the agent.
 */
export async function getAgentListings(id: string): Promise<AgentListings> {
  "use cache";
  cacheTag(CACHE_TAGS.listings, CACHE_TAGS.projects);
  cacheLife("minutes");
  const none: AgentListings = { homes: [], projects: [] };
  const { data, error } = await createPublicSupabase().rpc("agent_listings", { p_id: id });
  if (error) {
    logger.error("an agent's listings could not be read", { errorCode: error.code });
    return none;
  }
  const document = listingsSchema.safeParse(data);
  if (!document.success) return none;
  const now = Date.now();
  const homes: ListingRow[] = [];
  let skipped = 0;
  for (const row of document.data.homes) {
    const parsed = listingRowSchema.safeParse(row);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }
    const published = parsed.data.published_at ? Date.parse(parsed.data.published_at) : Number.NaN;
    homes.push({
      ...parsed.data,
      ageDays: Number.isNaN(published) ? null : Math.floor((now - published) / MS_PER_DAY),
    });
  }
  if (skipped > 0) {
    logger.warn("an agent's homes skipped, they do not match the expected shape", { skipped });
  }
  return {
    homes: homes.slice(0, AGENT_LISTINGS_MAX),
    projects: parseProjectListItems(document.data.projects, "agent").slice(0, AGENT_LISTINGS_MAX),
  };
}
