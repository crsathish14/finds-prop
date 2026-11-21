import {
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  WORK_MODES,
  type EmploymentType,
  type JobStatus,
  type WorkMode,
} from "./constants";

/**
 * The shapes the Careers pages and admin draw, and the functions that turn rows into them (R-BE-06: a read names its
 * columns and maps them to a view model; a page never sees a raw row). Pure: no framework and no storage, so a test
 * builds rows by hand and a client island may import it.
 */

/** The columns the public list's search function answers. */
export interface SearchRow {
  id: string;
  slug: string;
  title: string;
  department_id: string | null;
  department_slug: string | null;
  department_name: string | null;
  location: string;
  work_mode: string;
  employment_type: string;
  experience: string;
  summary: string;
  snippet: string | null;
  salary_note: string | null;
  closes_at: string | null;
  posted_at: string | null;
  total_count: number;
}

/** The public columns of one job, as the job page reads them. */
export const PUBLIC_JOB_COLUMNS =
  "id, slug, title, department_id, location, work_mode, employment_type, experience, summary, description, responsibilities, requirements, salary_note, apply_url, apply_email, closes_at, posted_at, updated_at";

export interface JobRow {
  id: string;
  slug: string;
  title: string;
  department_id: string;
  location: string;
  work_mode: string;
  employment_type: string;
  experience: string;
  summary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  salary_note: string | null;
  apply_url: string | null;
  apply_email: string | null;
  closes_at: string | null;
  posted_at: string | null;
  updated_at: string;
}

/** An admin row adds the status, the Trash date and the creation date. */
export interface AdminJobRow extends JobRow {
  status: string;
  deleted_at: string | null;
  created_at: string;
}

export interface JobDepartmentRef {
  slug: string;
  name: string;
}

/** One job on a card or in a list. */
export interface JobCardView {
  id: string;
  slug: string;
  title: string;
  department: JobDepartmentRef | null;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experience: string;
  summary: string;
  /** A passage around the matched words, the matches between [[ and ]] (see `snippetParts`); null with no search. */
  snippet: string | null;
  salaryNote: string | null;
  closesAt: string | null;
  postedAt: string | null;
}

/** One page of the public list. */
export interface JobListView {
  items: JobCardView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/** A job page. How to apply is one of the two: an https link or an email address. */
export interface JobDetailView extends Omit<JobCardView, "snippet" | "department"> {
  departmentId: string;
  department: JobDepartmentRef | null;
  description: string;
  responsibilities: string;
  requirements: string;
  applyUrl: string | null;
  applyEmail: string | null;
  updatedAt: string;
}

/** One row of the admin's list. */
export interface AdminJobRowView {
  id: string;
  slug: string;
  title: string;
  status: JobStatus;
  departmentId: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  postedAt: string | null;
  closesAt: string | null;
  updatedAt: string;
  trashed: boolean;
}

/** A job in the admin's editor. */
export interface AdminJobView extends AdminJobRowView {
  experience: string;
  summary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  salaryNote: string | null;
  applyUrl: string | null;
  applyEmail: string | null;
  createdAt: string;
}

function statusOf(value: string): JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value) ? (value as JobStatus) : "draft";
}

function workModeOf(value: string): WorkMode {
  return (WORK_MODES as readonly string[]).includes(value) ? (value as WorkMode) : "onsite";
}

function employmentTypeOf(value: string): EmploymentType {
  return (EMPLOYMENT_TYPES as readonly string[]).includes(value)
    ? (value as EmploymentType)
    : "full_time";
}

/** The pages count for a total: at least one, so an empty list still has a page 1. */
export function pageCountOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function toCardView(row: SearchRow): JobCardView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    department:
      row.department_slug && row.department_name
        ? { slug: row.department_slug, name: row.department_name }
        : null,
    location: row.location,
    workMode: workModeOf(row.work_mode),
    employmentType: employmentTypeOf(row.employment_type),
    experience: row.experience,
    summary: row.summary,
    snippet: row.snippet && row.snippet !== row.summary ? row.snippet : null,
    salaryNote: row.salary_note,
    closesAt: row.closes_at,
    postedAt: row.posted_at,
  };
}

export function toListView(rows: SearchRow[], page: number, pageSize: number): JobListView {
  const total = rows[0]?.total_count ?? 0;
  return {
    items: rows.map(toCardView),
    total,
    page,
    pageSize,
    pageCount: pageCountOf(total, pageSize),
  };
}

export function toDetailView(row: JobRow, department: JobDepartmentRef | null): JobDetailView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    departmentId: row.department_id,
    department,
    location: row.location,
    workMode: workModeOf(row.work_mode),
    employmentType: employmentTypeOf(row.employment_type),
    experience: row.experience,
    summary: row.summary,
    description: row.description,
    responsibilities: row.responsibilities,
    requirements: row.requirements,
    salaryNote: row.salary_note,
    applyUrl: row.apply_url,
    applyEmail: row.apply_email,
    closesAt: row.closes_at,
    postedAt: row.posted_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Whether a job can still be applied for at `now`. The row policy already hides a job after its closing moment, but a
 * page read from the cache may be a few minutes old, so the page asks again before it draws the Apply button.
 */
export function isJobOpenAt(job: { closesAt: string | null }, now: Date): boolean {
  return job.closesAt === null || new Date(job.closesAt).getTime() > now.getTime();
}

/** The columns the admin's list reads (no long text). */
export const ADMIN_ROW_COLUMNS =
  "id, slug, title, status, department_id, location, work_mode, employment_type, posted_at, closes_at, updated_at, deleted_at";

export interface AdminListRecord {
  id: string;
  slug: string;
  title: string;
  status: string;
  department_id: string;
  location: string;
  work_mode: string;
  employment_type: string;
  posted_at: string | null;
  closes_at: string | null;
  updated_at: string;
  deleted_at: string | null;
}

export function toAdminRowView(row: AdminListRecord): AdminJobRowView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: statusOf(row.status),
    departmentId: row.department_id,
    location: row.location,
    workMode: workModeOf(row.work_mode),
    employmentType: employmentTypeOf(row.employment_type),
    postedAt: row.posted_at,
    closesAt: row.closes_at,
    updatedAt: row.updated_at,
    trashed: row.deleted_at !== null,
  };
}

/** The columns the editor reads. */
export const ADMIN_JOB_COLUMNS =
  "id, slug, title, status, department_id, location, work_mode, employment_type, experience, summary, description, responsibilities, requirements, salary_note, apply_url, apply_email, posted_at, closes_at, updated_at, created_at, deleted_at";

export function toAdminJobView(row: AdminJobRow): AdminJobView {
  return {
    ...toAdminRowView(row),
    experience: row.experience,
    summary: row.summary,
    description: row.description,
    responsibilities: row.responsibilities,
    requirements: row.requirements,
    salaryNote: row.salary_note,
    applyUrl: row.apply_url,
    applyEmail: row.apply_email,
    createdAt: row.created_at,
  };
}

/** A description's paragraphs: a blank line starts a new one. The page draws each as text, never as HTML. */
export function descriptionParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** The points of a list: one per line, empty lines dropped. */
export function pointsOf(text: string): string[] {
  return text
    .split("\n")
    .map((point) => point.trim())
    .filter((point) => point.length > 0);
}

/** A search snippet cut into plain text and matched words, so a page can draw the matches without any HTML. */
export interface SnippetPart {
  text: string;
  matched: boolean;
}

export function snippetParts(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  const pattern = /\[\[(.*?)\]\]/g;
  let last = 0;
  for (const match of snippet.matchAll(pattern)) {
    const start = match.index;
    if (start > last) parts.push({ text: snippet.slice(last, start), matched: false });
    parts.push({ text: match[1] ?? "", matched: true });
    last = start + match[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), matched: false });
  return parts;
}
