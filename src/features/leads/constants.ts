/** The states a project lead can be in, as `project_leads.status` holds them (BR-46, BR-47: the only thing a builder changes). */
export const LEAD_STATUSES = ["new", "contacted", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** The state chips and box above the leads list: every state, or one. */
export const LEAD_STATE_FILTERS = ["all", ...LEAD_STATUSES] as const;
export type LeadStateFilter = (typeof LEAD_STATE_FILTERS)[number];

/** What the visitor asked for, as `project_leads.kind` holds it. */
export const LEAD_KINDS = ["enquiry", "site_visit", "brochure"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

/** Where a form submission stands with the CRM, as `form_submissions.crm_status` holds it. */
export const CRM_STATUSES = ["not_applicable", "pending", "success", "failed"] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];

/** The CRM box above the submissions list: any state, or one. */
export const CRM_FILTERS = ["any", ...CRM_STATUSES] as const;
export type CrmFilter = (typeof CRM_FILTERS)[number];

/** The date choices of the submissions list: the last 7, 30 or 90 days, or all of it. */
export const SUBMISSION_RANGES = ["7", "30", "90", "all"] as const;
export type SubmissionRange = (typeof SUBMISSION_RANGES)[number];
export const DEFAULT_SUBMISSION_RANGE: SubmissionRange = "30";

/** Rows on one page of either list. */
export const LEADS_PAGE_SIZE = 25;
export const SUBMISSIONS_PAGE_SIZE = 25;

/** The longest source the filter takes (`form_submissions.source` holds 200). */
export const SOURCE_MAX = 200;
/** How many recent submissions are read to learn which sources exist. */
export const SOURCE_SAMPLE = 500;
