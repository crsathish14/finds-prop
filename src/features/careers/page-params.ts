import { z } from "zod";
import {
  EMPLOYMENT_TYPES,
  JOB_ADMIN_VIEWS,
  JOB_LOCATION_FILTER_MAX,
  JOB_SEARCH_MAX,
  WORK_MODES,
  type EmploymentType,
  type JobAdminViewName,
  type WorkMode,
} from "./constants";

/**
 * What the Careers pages read from the address (ADR-143, frontend.md 6.1): one schema for each page, defaults left out,
 * anything that does not fit dropped instead of refused, so a hand-edited address still shows a page.
 */

/** The public list's address, and the address of one job. */
export const CAREERS_PATH = "/careers";
export const jobPath = (slug: string): string => `${CAREERS_PATH}/${slug}`;
/** The admin list's address, the new job page and the editor. */
export const ADMIN_CAREERS_PATH = "/admin/careers";
export const ADMIN_CAREERS_NEW_PATH = "/admin/careers/new";
export const adminJobEditPath = (jobId: string): string => `${ADMIN_CAREERS_PATH}/${jobId}`;

const PAGE_MAX = 10_000;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type RawParams = Record<string, string | string[] | undefined>;

/** The first value of a repeated parameter. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A page number from 1; anything else is page 1. */
const pageNumber = z.coerce.number().int().min(1).max(PAGE_MAX).catch(1);

const publicSchema = z.object({
  words: z.string().trim().max(JOB_SEARCH_MAX).catch(""),
  department: z.string().regex(SLUG).max(60).catch(""),
  location: z.string().trim().max(JOB_LOCATION_FILTER_MAX).catch(""),
  mode: z.enum(WORK_MODES).or(z.literal("")).catch(""),
  type: z.enum(EMPLOYMENT_TYPES).or(z.literal("")).catch(""),
  page: pageNumber,
});

/** The words typed, the four filters chosen (each empty for "all") and the page on /careers. */
export type PublicJobParams = {
  query: string;
  department: string;
  location: string;
  mode: WorkMode | "";
  type: EmploymentType | "";
  page: number;
};

export function parsePublicJobParams(raw: RawParams): PublicJobParams {
  const parsed = publicSchema.parse({
    words: first(raw.q) ?? "",
    department: first(raw.department) ?? "",
    location: first(raw.location) ?? "",
    mode: first(raw.mode) ?? "",
    type: first(raw.type) ?? "",
    page: first(raw.page) ?? 1,
  });
  return {
    query: parsed.words,
    department: parsed.department,
    location: parsed.location,
    mode: parsed.mode,
    type: parsed.type,
    page: parsed.page,
  };
}

/** The address of the public list for a choice: each part left out when empty, and page 1 left out. */
export function jobsHref(choice: Partial<PublicJobParams> = {}): string {
  const search = new URLSearchParams();
  if (choice.query) search.set("q", choice.query);
  if (choice.department) search.set("department", choice.department);
  if (choice.location) search.set("location", choice.location);
  if (choice.mode) search.set("mode", choice.mode);
  if (choice.type) search.set("type", choice.type);
  if (choice.page && choice.page > 1) search.set("page", String(choice.page));
  const text = search.toString();
  return text === "" ? CAREERS_PATH : `${CAREERS_PATH}?${text}`;
}

const adminSchema = z.object({
  status: z.enum(JOB_ADMIN_VIEWS).catch("all"),
  department: z.uuid().catch(""),
  words: z.string().trim().max(100).catch(""),
  page: pageNumber,
});

/** The tab, the department (an id), the words and the page chosen on the admin list. */
export type AdminJobParams = {
  status: JobAdminViewName;
  department: string;
  query: string;
  page: number;
};

export function parseAdminJobParams(raw: RawParams): AdminJobParams {
  const parsed = adminSchema.parse({
    status: first(raw.status) ?? "all",
    department: (first(raw.department) ?? "").toLowerCase(),
    words: first(raw.q) ?? "",
    page: first(raw.page) ?? 1,
  });
  return {
    status: parsed.status,
    department: parsed.department,
    query: parsed.words,
    page: parsed.page,
  };
}

/** The address of the admin list for a choice, with the defaults (all, no department, no words, page 1) left out. */
export function adminJobsHref(choice: Partial<AdminJobParams> = {}): string {
  const search = new URLSearchParams();
  if (choice.status && choice.status !== "all") search.set("status", choice.status);
  if (choice.department) search.set("department", choice.department);
  if (choice.query) search.set("q", choice.query);
  if (choice.page && choice.page > 1) search.set("page", String(choice.page));
  const text = search.toString();
  return text === "" ? ADMIN_CAREERS_PATH : `${ADMIN_CAREERS_PATH}?${text}`;
}

/** A job address as it must read: lower case words joined by hyphens, at most 120 characters. */
export function parseJobSlug(value: string): string | null {
  return value.length >= 2 && value.length <= 120 && SLUG.test(value) ? value : null;
}
