import { z } from "zod";

/**
 * The numbers of the builder's Dashboard and Insights pages (S7-T03 step E), as the screens use them: one row from
 * `builder_insights()`, with a count for every tile. The portfolio numbers do not depend on the dates.
 */
export interface InsightsNumbers {
  projects: number;
  activeProjects: number;
  totalUnits: number;
  availableUnits: number;
  soldUnits: number;
  views: number;
  visitors: number;
  shortlists: number;
  comparisons: number;
  brochures: number;
  calls: number;
  whatsapp: number;
  enquiries: number;
  leads: number;
  siteVisits: number;
}

/** A count from the database: whole and not negative. */
const count = z.number().int().min(0);

const rowSchema = z.object({
  projects: count,
  active_projects: count,
  total_units: count,
  available_units: count,
  sold_units: count,
  views: count,
  visitors: count,
  shortlists: count,
  comparisons: count,
  brochures: count,
  calls: count,
  whatsapp: count,
  enquiries: count,
  leads: count,
  site_visits: count,
});

/** The row from the database as the screen's numbers; a row that is not in the expected shape is a failed read. */
export function toInsightsNumbers(rows: readonly unknown[] | null): InsightsNumbers {
  const row = rowSchema.parse(rows?.[0]);
  return {
    projects: row.projects,
    activeProjects: row.active_projects,
    totalUnits: row.total_units,
    availableUnits: row.available_units,
    soldUnits: row.sold_units,
    views: row.views,
    visitors: row.visitors,
    shortlists: row.shortlists,
    comparisons: row.comparisons,
    brochures: row.brochures,
    calls: row.calls,
    whatsapp: row.whatsapp,
    enquiries: row.enquiries,
    leads: row.leads,
    siteVisits: row.site_visits,
  };
}

/** The projects waiting for approval: how many, and the name when there is exactly one. */
export interface PendingNotice {
  count: number;
  name: string | null;
}

export function pendingNotice(
  projects: readonly { name: string; moderation: string }[],
): PendingNotice {
  const waiting = projects.filter((project) => project.moderation === "pending");
  return { count: waiting.length, name: waiting.length === 1 ? (waiting[0]?.name ?? null) : null };
}
