import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { getPublicCategories } from "@/features/content-categories";
import { CACHE_TAGS, jobTag } from "@/lib/cache-tags";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import {
  JOB_ADMIN_PAGE_SIZE,
  JOB_LOCATION_FILTER_MAX,
  JOB_PAGE_SIZE,
  JOB_SEARCH_MAX,
  type EmploymentType,
  type JobStatus,
  type WorkMode,
} from "./constants";
import {
  ADMIN_JOB_COLUMNS,
  ADMIN_ROW_COLUMNS,
  PUBLIC_JOB_COLUMNS,
  pageCountOf,
  toAdminJobView,
  toAdminRowView,
  toDetailView,
  toListView,
  type AdminJobRowView,
  type AdminJobView,
  type JobDetailView,
  type JobListView,
  type SearchRow,
} from "./view";

/** What the public list is asked: free words, the filters and a page number (from 1). */
export interface JobListQuery {
  query?: string | null;
  /** A department slug. */
  department?: string | null;
  /** A place as written in the jobs (any case). */
  location?: string | null;
  workMode?: WorkMode | null;
  type?: EmploymentType | null;
  page: number;
}

/**
 * One page of the public list through the database's search function, which runs as the caller: a visitor sees only
 * open jobs that have not closed and are not in Trash. A page past the end answers no cards but the real total (read
 * again from page 1), so the page can tell "no such page" from "no jobs". Words longer than the database's limit are
 * cut here, so a long paste is a search and not an error. A failed read throws, so the page's error state shows it.
 */
export async function readJobList(
  supabase: SupabaseClient<Database>,
  list: JobListQuery,
  pageSize: number = JOB_PAGE_SIZE,
): Promise<JobListView> {
  const page = Math.max(1, Math.floor(list.page));
  const words = list.query?.trim().slice(0, JOB_SEARCH_MAX);
  const ask = async (offset: number, limit: number) => {
    const { data, error } = await supabase.rpc("search_job_postings", {
      ...(words ? { p_query: words } : {}),
      ...(list.department ? { p_department: list.department } : {}),
      ...(list.location ? { p_location: list.location } : {}),
      ...(list.workMode ? { p_work_mode: list.workMode } : {}),
      ...(list.type ? { p_type: list.type } : {}),
      p_limit: limit,
      p_offset: offset,
    });
    if (error) {
      logger.error("the jobs list could not be read", { errorCode: error.code });
      throw error;
    }
    return data as SearchRow[];
  };
  const rows = await ask((page - 1) * pageSize, pageSize);
  if (rows.length === 0 && page > 1) {
    const first = await ask(0, 1);
    const total = first[0]?.total_count ?? 0;
    return { items: [], total, page, pageSize, pageCount: pageCountOf(total, pageSize) };
  }
  return toListView(rows, page, pageSize);
}

/** The list without free words is cached under the Careers tag (a page of the newest, one filter or several). */
async function getCachedJobList(list: JobListQuery): Promise<JobListView> {
  "use cache";
  cacheTag(CACHE_TAGS.careers);
  cacheLife("minutes");
  return readJobList(createPublicSupabase(), list);
}

/**
 * The public list. A search (free words) is never cached (search results are not, ADR-042); every other view of the
 * list is public data under the Careers tag, so a change in the admin refreshes it at once.
 */
export async function getJobList(list: JobListQuery): Promise<JobListView> {
  const words = list.query?.trim() ?? "";
  if (words !== "") return readJobList(createPublicSupabase(), { ...list, query: words });
  return getCachedJobList({
    department: list.department ?? null,
    location: list.location ?? null,
    workMode: list.workMode ?? null,
    type: list.type ?? null,
    page: list.page,
  });
}

/**
 * One open job by its address, or `null` when there is none (a draft, a closed one, one that passed its closing date,
 * one in Trash and a wrong address all read the same: the row policy hides them). Cached under the Careers tag and the
 * job's own; the page asks `isJobOpenAt` again, because a cached job may have closed a few minutes ago.
 */
export async function getJob(slug: string): Promise<JobDetailView | null> {
  "use cache";
  cacheTag(CACHE_TAGS.careers, jobTag(slug));
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase()
    .from("job_postings")
    .select(PUBLIC_JOB_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    logger.error("a job could not be read", { errorCode: error.code });
    throw error;
  }
  if (!data) return null;
  const departments = await getPublicCategories("department");
  const department = departments.find((item) => item.id === data.department_id);
  return toDetailView(data, department ? { slug: department.slug, name: department.name } : null);
}

/** What the filter row offers: the departments and places of the open jobs, and how many jobs there are. */
export interface JobFilters {
  departments: { slug: string; name: string }[];
  locations: string[];
  total: number;
}

/** Pure, so a test calls it: the departments (in the admin's order) and places (A to Z) that have an open job. */
export function toJobFilters(
  jobs: readonly { department_id: string; location: string }[],
  departments: readonly { id: string; slug: string; name: string }[],
): JobFilters {
  const used = new Set(jobs.map((job) => job.department_id));
  const places = new Map<string, string>();
  for (const job of jobs) {
    const key = job.location.trim().toLowerCase();
    if (!places.has(key)) places.set(key, job.location.trim());
  }
  return {
    departments: departments
      .filter((department) => used.has(department.id))
      .map((department) => ({ slug: department.slug, name: department.name })),
    locations: [...places.values()]
      .sort((first, second) => first.localeCompare(second))
      .slice(0, JOB_LOCATION_FILTER_MAX),
    total: jobs.length,
  };
}

/** The filter row's choices. Public data under the Careers tag; a failed read answers no choices and is logged. */
export async function getJobFilters(): Promise<JobFilters> {
  "use cache";
  cacheTag(CACHE_TAGS.careers);
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase()
    .from("job_postings")
    .select("department_id, location")
    .eq("status", "open")
    .limit(500);
  if (error) {
    logger.error("the job filters could not be read", { errorCode: error.code });
    return { departments: [], locations: [], total: 0 };
  }
  return toJobFilters(data, await getPublicCategories("department"));
}

/** The addresses of the open jobs, for the sitemap. Public data under the Careers tag. */
export async function getJobSitemapEntries(): Promise<{ slug: string; updatedAt: string }[]> {
  "use cache";
  cacheTag(CACHE_TAGS.careers);
  cacheLife("hours");

  const { data, error } = await createPublicSupabase()
    .from("job_postings")
    .select("slug, updated_at")
    .eq("status", "open")
    .order("posted_at", { ascending: false })
    .limit(5000);
  if (error) {
    logger.error("the job sitemap entries could not be read", { errorCode: error.code });
    return [];
  }
  return data.map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
}

/** What the admin's list is asked: a status (or Trash), a department, free words and a page number (from 1). */
export interface AdminJobListQuery {
  status?: JobStatus | "trash" | null;
  departmentId?: string | null;
  query?: string | null;
  page: number;
}

export interface AdminJobList {
  rows: AdminJobRowView[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * One page of the admin's list, newest edit first, read as the signed-in admin (the row policy lets only the super
 * admin see drafts, closed jobs and Trash). Trash is its own view; every other view leaves Trash out. Never cached: the
 * list must be right after every change. A failed read throws, so the portal's error page shows it.
 */
export async function readAdminJobList(
  supabase: SupabaseClient<Database>,
  list: AdminJobListQuery,
  pageSize: number = JOB_ADMIN_PAGE_SIZE,
): Promise<AdminJobList> {
  const page = Math.max(1, Math.floor(list.page));
  let request = supabase
    .from("job_postings")
    .select(ADMIN_ROW_COLUMNS, { count: "exact" })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  request =
    list.status === "trash"
      ? request.not("deleted_at", "is", null)
      : request.is("deleted_at", null);
  if (list.status && list.status !== "trash") request = request.eq("status", list.status);
  if (list.departmentId) request = request.eq("department_id", list.departmentId);
  const words = list.query?.trim().slice(0, JOB_SEARCH_MAX) ?? "";
  if (words !== "") {
    request = request.textSearch("search_vector", words, { type: "websearch", config: "english" });
  }
  const { data, error, count } = await request;
  if (error) {
    logger.error("the admin's jobs list could not be read", { errorCode: error.code });
    throw error;
  }
  const total = count ?? 0;
  return { rows: data.map(toAdminRowView), total, page, pageCount: pageCountOf(total, pageSize) };
}

export async function getAdminJobList(list: AdminJobListQuery): Promise<AdminJobList> {
  return readAdminJobList(await createServerSupabase(), list);
}

/** How many jobs each tab of the admin's list holds. */
export interface AdminJobCounts {
  draft: number;
  open: number;
  closed: number;
  trash: number;
}

export async function readAdminJobCounts(
  supabase: SupabaseClient<Database>,
): Promise<AdminJobCounts> {
  const count = async (status: JobStatus | "trash"): Promise<number> => {
    const request = supabase.from("job_postings").select("id", { count: "exact", head: true });
    const { count: found, error } =
      status === "trash"
        ? await request.not("deleted_at", "is", null)
        : await request.is("deleted_at", null).eq("status", status);
    if (error) {
      logger.error("the admin's job counts could not be read", { errorCode: error.code });
      throw error;
    }
    return found ?? 0;
  };
  const [draft, open, closed, trash] = await Promise.all([
    count("draft"),
    count("open"),
    count("closed"),
    count("trash"),
  ]);
  return { draft, open, closed, trash };
}

export async function getAdminJobCounts(): Promise<AdminJobCounts> {
  return readAdminJobCounts(await createServerSupabase());
}

/** One job for the editor, or `null` when there is none. Read as the signed-in admin; never cached. */
export async function readAdminJob(
  supabase: SupabaseClient<Database>,
  jobId: string,
): Promise<AdminJobView | null> {
  const { data, error } = await supabase
    .from("job_postings")
    .select(ADMIN_JOB_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();
  if (error) {
    logger.error("an admin job could not be read", { errorCode: error.code });
    throw error;
  }
  return data ? toAdminJobView(data) : null;
}

export async function getAdminJob(jobId: string): Promise<AdminJobView | null> {
  return readAdminJob(await createServerSupabase(), jobId);
}

/** What the public Careers list draws: the page of jobs, the filter choices and whether nothing is open at all. */
export interface CareersPageData {
  list: JobListView;
  filters: JobFilters;
  /** The department that really exists among the open jobs (an unknown one in the address is dropped), or "". */
  department: string;
  /** No open job and no search or filter: the page says so instead of drawing an empty search. */
  nothingOpen: boolean;
}

/** The unfiltered words of a choice, for a test and the page alike. */
export interface CareersPageParams {
  query: string;
  department: string;
  location: string;
  mode: WorkMode | "";
  type: EmploymentType | "";
  page: number;
}

/**
 * Everything the public list needs, in one call: the filter row's choices and the page of jobs. A department in the
 * address that no open job belongs to is dropped. Free words go to the search function and are never cached; every other
 * view of the list is a cached page under the Careers tag.
 */
export async function getCareersPage(params: CareersPageParams): Promise<CareersPageData> {
  const filters = await getJobFilters();
  const department = filters.departments.some((item) => item.slug === params.department)
    ? params.department
    : "";
  const list = await getJobList({
    query: params.query,
    department: department === "" ? null : department,
    location: params.location === "" ? null : params.location,
    workMode: params.mode === "" ? null : params.mode,
    type: params.type === "" ? null : params.type,
    page: params.page,
  });
  const asked =
    params.query !== "" ||
    department !== "" ||
    params.location !== "" ||
    params.mode !== "" ||
    params.type !== "";
  return { list, filters, department, nothingOpen: !asked && list.total === 0 };
}

/**
 * How many jobs each department holds, the Trash included (a department that holds only trashed jobs still cannot be
 * deleted), by department id. Read as the signed-in admin; never cached. A failed read throws.
 */
export async function readJobDepartmentUsage(
  supabase: SupabaseClient<Database>,
): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("job_postings").select("department_id").limit(10_000);
  if (error) {
    logger.error("the job department usage could not be read", { errorCode: error.code });
    throw error;
  }
  const usage: Record<string, number> = {};
  for (const row of data) {
    usage[row.department_id] = (usage[row.department_id] ?? 0) + 1;
  }
  return usage;
}

export async function getJobDepartmentUsage(): Promise<Record<string, number>> {
  return readJobDepartmentUsage(await createServerSupabase());
}
