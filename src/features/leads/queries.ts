import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import {
  LEADS_PAGE_SIZE,
  SOURCE_SAMPLE,
  SUBMISSIONS_PAGE_SIZE,
  type SubmissionRange,
} from "./constants";
import { decodeCursor, encodeCursor } from "./cursor";
import type { LeadFilters, SubmissionFilters } from "./schemas";
import {
  toFieldLabels,
  toLeadViews,
  toSources,
  toSubmissionViews,
  type FilterOptions,
  type LeadCounts,
  type LeadsPage,
  type SubmissionsPage,
} from "./view";

/**
 * The admin's Leads reads (S7-T07, FR-ADM-06), as the signed-in admin through their own session: the policies of
 * `project_leads`, `form_submissions`, `forms` and `projects` let an admin read everything, and anyone else would
 * get nothing (a builder reads only the leads of their own projects). Never cached: the lists must be right after every
 * change. A failed read throws, so the error page shows it. The `read…` functions take the client, so the integration
 * tests can pass the admin's; the `get…` ones make it from the cookies.
 */

type Client = SupabaseClient<Database>;

const LEAD_COLUMNS =
  "id, project_id, kind, name, phone, email, message, visit_date, status, created_at, projects(name)";

const SUBMISSION_COLUMNS =
  "id, form_id, form_name, name, mobile, email, data, source, crm_status, crm_lead_id, crm_http_status, crm_attempts, next_retry_at, last_error, created_at, projects(name), crm_integrations(name)";

/** The "after this row" condition of a newest-first list: older, or the same moment with a smaller id. */
const olderThan = (cursor: { at: string; id: string }) =>
  `created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`;

/** One page of project leads, newest first, with the number of leads the filters match. */
export async function readLeadsPage(supabase: Client, filters: LeadFilters): Promise<LeadsPage> {
  const cursor = decodeCursor(filters.after);
  let page = supabase.from("project_leads").select(LEAD_COLUMNS);
  let counted = supabase.from("project_leads").select("id", { count: "exact", head: true });
  if (filters.project) {
    page = page.eq("project_id", filters.project);
    counted = counted.eq("project_id", filters.project);
  }
  if (filters.status !== "all") {
    page = page.eq("status", filters.status);
    counted = counted.eq("status", filters.status);
  }
  const ordered = page
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(LEADS_PAGE_SIZE + 1);
  const [rows, count] = await Promise.all([
    cursor ? ordered.or(olderThan(cursor)) : ordered,
    counted,
  ]);
  if (rows.error) {
    logger.error("admin leads could not be read", { errorCode: rows.error.code });
    throw rows.error;
  }
  if (count.error) {
    logger.error("admin leads could not be counted", { errorCode: count.error.code });
    throw count.error;
  }
  const hasMore = rows.data.length > LEADS_PAGE_SIZE;
  const shownRows = hasMore ? rows.data.slice(0, LEADS_PAGE_SIZE) : rows.data;
  const { leads, skipped } = toLeadViews(shownRows);
  if (skipped > 0) logger.warn("admin lead rows could not be read", { skipped });
  const last = leads.at(-1);
  return {
    leads,
    total: count.count ?? leads.length,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}

/** The moment a date range starts, as an ISO time; null for "all". */
export function rangeStart(range: SubmissionRange, now: Date): string | null {
  if (range === "all") return null;
  return new Date(now.getTime() - Number(range) * 24 * 60 * 60 * 1000).toISOString();
}

/** One page of form submissions, newest first, with the answers labelled by the forms' own questions and the number of submissions the filters match. */
export async function readSubmissionsPage(
  supabase: Client,
  filters: SubmissionFilters,
  now: Date,
): Promise<SubmissionsPage> {
  const cursor = decodeCursor(filters.after);
  const since = rangeStart(filters.range, now);
  let page = supabase.from("form_submissions").select(SUBMISSION_COLUMNS);
  let counted = supabase.from("form_submissions").select("id", { count: "exact", head: true });
  if (since) {
    page = page.gte("created_at", since);
    counted = counted.gte("created_at", since);
  }
  if (filters.form) {
    page = page.eq("form_id", filters.form);
    counted = counted.eq("form_id", filters.form);
  }
  if (filters.project) {
    page = page.eq("project_id", filters.project);
    counted = counted.eq("project_id", filters.project);
  }
  if (filters.source) {
    page = page.eq("source", filters.source);
    counted = counted.eq("source", filters.source);
  }
  if (filters.crm !== "any") {
    page = page.eq("crm_status", filters.crm);
    counted = counted.eq("crm_status", filters.crm);
  }
  const ordered = page
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(SUBMISSIONS_PAGE_SIZE + 1);
  const [rows, count] = await Promise.all([
    cursor ? ordered.or(olderThan(cursor)) : ordered,
    counted,
  ]);
  if (rows.error) {
    logger.error("admin submissions could not be read", { errorCode: rows.error.code });
    throw rows.error;
  }
  if (count.error) {
    logger.error("admin submissions could not be counted", { errorCode: count.error.code });
    throw count.error;
  }
  const hasMore = rows.data.length > SUBMISSIONS_PAGE_SIZE;
  const shownRows = hasMore ? rows.data.slice(0, SUBMISSIONS_PAGE_SIZE) : rows.data;

  // The questions of the forms on this page, so an answer shows its words and not only its key.
  const formIds = [...new Set(shownRows.flatMap((row) => (row.form_id ? [row.form_id] : [])))];
  const forms =
    formIds.length > 0 ? await supabase.from("forms").select("id, fields").in("id", formIds) : null;
  if (forms?.error) {
    logger.error("admin submission forms could not be read", { errorCode: forms.error.code });
    throw forms.error;
  }
  const { submissions, skipped } = toSubmissionViews(shownRows, toFieldLabels(forms?.data ?? []));
  if (skipped > 0) logger.warn("admin submission rows could not be read", { skipped });
  const last = submissions.at(-1);
  return {
    submissions,
    total: count.count ?? submissions.length,
    nextCursor: hasMore && last ? encodeCursor(last) : null,
    readAt: now.getTime(),
  };
}

/** The projects, forms and sources to filter by. The sources are those of the most recent submissions. */
export async function readFilterOptions(supabase: Client): Promise<FilterOptions> {
  const [projects, forms, sources] = await Promise.all([
    supabase.rpc("admin_projects").select("id, name").order("name", { ascending: true }),
    supabase.from("forms").select("id, name").order("name", { ascending: true }),
    supabase
      .from("form_submissions")
      .select("source")
      .not("source", "is", null)
      .order("created_at", { ascending: false })
      .limit(SOURCE_SAMPLE),
  ]);
  for (const result of [projects, forms, sources]) {
    if (result.error) {
      logger.error("admin lead filters could not be read", { errorCode: result.error.code });
      throw result.error;
    }
  }
  return {
    projects: (projects.data ?? []).map(({ id, name }) => ({ id, name })),
    forms: (forms.data ?? []).map(({ id, name }) => ({ id, name })),
    sources: toSources(sources.data ?? []),
  };
}

/** The numbers on the two tabs: all project leads and all form submissions. */
export async function readLeadCounts(supabase: Client): Promise<LeadCounts> {
  const [leads, submissions] = await Promise.all([
    supabase.from("project_leads").select("id", { count: "exact", head: true }),
    supabase.from("form_submissions").select("id", { count: "exact", head: true }),
  ]);
  for (const result of [leads, submissions]) {
    if (result.error) {
      logger.error("admin lead counts could not be read", { errorCode: result.error.code });
      throw result.error;
    }
  }
  return { leads: leads.count ?? 0, submissions: submissions.count ?? 0 };
}

/** The page of project leads for the signed-in admin. */
export async function getLeadsPage(filters: LeadFilters): Promise<LeadsPage> {
  return readLeadsPage(await createServerSupabase(), filters);
}

/** The page of form submissions for the signed-in admin, counted from now. */
export async function getSubmissionsPage(filters: SubmissionFilters): Promise<SubmissionsPage> {
  return readSubmissionsPage(await createServerSupabase(), filters, new Date());
}

/** The tab numbers for the signed-in admin. */
export async function getLeadCounts(): Promise<LeadCounts> {
  return readLeadCounts(await createServerSupabase());
}

/** The filter choices for the signed-in admin. */
export async function getFilterOptions(): Promise<FilterOptions> {
  return readFilterOptions(await createServerSupabase());
}
