import { BUILDER_LOGO_BUCKET, publicStorageUrl } from "@/lib/storage-url";
import type { AgentCardData } from "@/components/domain/agent-card";
import type { AgentRow } from "./schemas";

/** The address of an agent's page: `/agents/{id}`. */
export const AGENTS_PATH = "/agents";

export function agentPath(id: string): string {
  return `${AGENTS_PATH}/${id}`;
}

/** True for a text the database could hold as an agent's id. */
export function isAgentId(text: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
}

/** Whole years since the year the agent started, or null when it is not given or not in the past. */
export function yearsOfExperience(startedYear: number | null, currentYear: number): number | null {
  if (startedYear === null) return null;
  const years = currentYear - startedYear;
  return years >= 1 ? years : null;
}

/** Only a web address is used as a picture: the uploaded logo first, then the older logo link, else nothing. */
export function agentPhoto(row: AgentRow, supabaseUrl: string): string | null {
  if (row.logo_path) return publicStorageUrl(supabaseUrl, BUILDER_LOGO_BUCKET, row.logo_path);
  const link = row.logo_url?.trim();
  return link && /^https:\/\//i.test(link) ? link : null;
}

/** An agent as the card takes it; a missing fact stays missing (the card leaves it out). */
export function toAgentCard(
  row: AgentRow,
  supabaseUrl: string,
  currentYear: number,
): AgentCardData {
  return {
    name: row.name,
    photo: agentPhoto(row, supabaseUrl),
    tagline: row.tagline,
    years: yearsOfExperience(row.established_year, currentYear),
    listings: row.listing_count > 0 ? row.listing_count : null,
    localities: row.localities,
    profileHref: agentPath(row.id),
  };
}
