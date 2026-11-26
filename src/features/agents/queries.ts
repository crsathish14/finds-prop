import "server-only";
import { cacheLife, cacheTag } from "next/cache";
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
