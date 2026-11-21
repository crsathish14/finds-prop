/**
 * The Careers module's limits and fixed lists (ADR-143, ADR-145). Each limit is also a check in the `job_postings`
 * table, so the form, the action and the database agree; a change here needs a new migration beside it.
 */
export const JOB_STATUSES = ["draft", "open", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const WORK_MODES = ["onsite", "hybrid", "remote"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const JOB_TITLE_MIN = 3;
export const JOB_TITLE_MAX = 160;
export const JOB_SLUG_MIN = 2;
export const JOB_SLUG_MAX = 120;
export const JOB_LOCATION_MIN = 2;
export const JOB_LOCATION_MAX = 120;
export const JOB_EXPERIENCE_MAX = 80;
export const JOB_SUMMARY_MAX = 320;
export const JOB_DESCRIPTION_MAX = 8000;
export const JOB_RESPONSIBILITIES_MAX = 4000;
export const JOB_REQUIREMENTS_MAX = 4000;
export const JOB_SALARY_NOTE_MAX = 120;
export const JOB_APPLY_URL_MAX = 500;
export const JOB_APPLY_EMAIL_MAX = 254;

/** The apply address must be https, with a host and no sign-in part (the table checks the same pattern). */
export const JOB_APPLY_URL_PATTERN = /^https:\/\/[^\s/?#@]+([/?#][^\s]*)?$/;
export const JOB_APPLY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** How many jobs one page of the public list holds. */
export const JOB_PAGE_SIZE = 12;
/** The admin's list. */
export const JOB_ADMIN_PAGE_SIZE = 20;
/** The longest search a visitor may type (the database function's limit) and the most places the filter lists. */
export const JOB_SEARCH_MAX = 200;
export const JOB_LOCATION_FILTER_MAX = 50;

/** The admin list's tabs: one status, or the Trash itself. */
export const JOB_ADMIN_VIEWS = ["all", "open", "draft", "closed", "trash"] as const;
export type JobAdminViewName = (typeof JOB_ADMIN_VIEWS)[number];
