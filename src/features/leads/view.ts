import { z } from "zod";
import {
  CRM_STATUSES,
  LEAD_KINDS,
  LEAD_STATUSES,
  type CrmStatus,
  type LeadKind,
  type LeadStatus,
} from "./constants";

/** One project lead as the admin's Leads page shows it (S7-T07). Dates are ISO text; the screen formats them. */
export interface LeadView {
  id: string;
  projectId: string;
  projectName: string;
  kind: LeadKind;
  name: string;
  /** Digits only, as stored. */
  phone: string;
  email: string | null;
  message: string | null;
  /** yyyy-mm-dd, for a site visit. */
  visitDate: string | null;
  status: LeadStatus;
  createdAt: string;
}

export interface LeadsPage {
  leads: LeadView[];
  /** The number of leads the filters match in all. */
  total: number;
  nextCursor: string | null;
}

/** An answer on a form, as it was stored. */
export type AnswerValue = string | number | boolean | string[];

export interface SubmissionAnswer {
  key: string;
  /** The question's words from the form as it is now, or the key when the form no longer has it. */
  label: string;
  value: AnswerValue;
}

/** How a submission stands with the CRM. */
export interface SubmissionCrm {
  status: CrmStatus;
  httpStatus: number | null;
  attempts: number;
  /** When the next automatic retry is due, for a failed one that still has attempts left. */
  nextRetryAt: string | null;
  lastError: string | null;
  /** The CRM's own id for the lead, once delivered. */
  leadId: string | null;
}

/** One form submission as the admin's submissions list and its details show it. */
export interface SubmissionView {
  id: string;
  formName: string;
  projectName: string | null;
  name: string | null;
  mobile: string | null;
  email: string | null;
  source: string | null;
  /** The CRM connection that took the submission (its name), or null when none has: not linked, or since deleted. */
  agentName: string | null;
  crm: SubmissionCrm;
  /** The answers other than the name, mobile and email, which have their own fields. */
  answers: SubmissionAnswer[];
  createdAt: string;
}

export interface SubmissionsPage {
  submissions: SubmissionView[];
  total: number;
  nextCursor: string | null;
  /** When the page was read (ms), so "in 30 minutes" is worked out from one moment on the server and in the browser. */
  readAt: number;
}

/** The numbers on the two tabs: every project lead and every form submission, whatever the filters. */
export interface LeadCounts {
  leads: number;
  submissions: number;
}

/** The choices of the filters. */
export interface FilterOptions {
  projects: { id: string; name: string }[];
  forms: { id: string; name: string }[];
  sources: string[];
}

export interface LeadDbRow {
  id: string;
  project_id: string;
  kind: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  visit_date: string | null;
  status: string;
  created_at: string;
  projects: { name: string } | null;
}

const isOneOf = <T extends string>(list: readonly T[], value: string): value is T =>
  (list as readonly string[]).includes(value);

/** Pure: the rows as views. A row with a kind or state this page does not know is left out and counted, so one odd row never breaks the list. */
export function toLeadViews(rows: LeadDbRow[]): { leads: LeadView[]; skipped: number } {
  const leads: LeadView[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (!isOneOf(LEAD_KINDS, row.kind) || !isOneOf(LEAD_STATUSES, row.status)) {
      skipped += 1;
      continue;
    }
    leads.push({
      id: row.id,
      projectId: row.project_id,
      projectName: row.projects?.name ?? "",
      kind: row.kind,
      name: row.name,
      phone: row.phone,
      email: row.email,
      message: row.message,
      visitDate: row.visit_date,
      status: row.status,
      createdAt: row.created_at,
    });
  }
  return { leads, skipped };
}

export interface SubmissionDbRow {
  id: string;
  form_id: string | null;
  form_name: string;
  name: string | null;
  mobile: string | null;
  email: string | null;
  data: unknown;
  source: string | null;
  crm_status: string;
  crm_lead_id: string | null;
  crm_http_status: number | null;
  crm_attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  created_at: string;
  projects: { name: string } | null;
  crm_integrations: { name: string } | null;
}

/** The questions of a form by key: only `key` and `label` are read, so a form saved by a later builder still reads. */
const formFieldsLabels = z.array(z.object({ key: z.string(), label: z.string() }));

/** Pure: the question text of each stored form, by form id and answer key. A form whose fields cannot be read has none. */
export function toFieldLabels(
  forms: { id: string; fields: unknown }[],
): Map<string, Map<string, string>> {
  const byForm = new Map<string, Map<string, string>>();
  for (const form of forms) {
    const parsed = formFieldsLabels.safeParse(form.fields);
    byForm.set(
      form.id,
      new Map(parsed.success ? parsed.data.map((field) => [field.key, field.label]) : []),
    );
  }
  return byForm;
}

/** The keys that have their own fields on a submission and so are not listed with the answers. */
const OWN_FIELDS = new Set(["name", "mobile", "email"]);

const isAnswer = (value: unknown): value is AnswerValue =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  (Array.isArray(value) && value.every((item) => typeof item === "string"));

/** Pure: the answers of a submission in the order of the form's questions, then any the form no longer has. */
export function toAnswers(
  data: unknown,
  labels: Map<string, string> | undefined,
): SubmissionAnswer[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return [];
  const stored = Object.entries(data).filter(
    ([key, value]) => !OWN_FIELDS.has(key) && isAnswer(value),
  ) as [string, AnswerValue][];
  const position = (key: string): number => {
    const index = labels ? [...labels.keys()].indexOf(key) : -1;
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return stored
    .map(([key, value]) => ({ key, label: labels?.get(key) ?? key, value }))
    .sort((first, second) => position(first.key) - position(second.key));
}

/** Pure: the rows as views. A row with a CRM state this page does not know is left out and counted. */
export function toSubmissionViews(
  rows: SubmissionDbRow[],
  labels: Map<string, Map<string, string>>,
): { submissions: SubmissionView[]; skipped: number } {
  const submissions: SubmissionView[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (!isOneOf(CRM_STATUSES, row.crm_status)) {
      skipped += 1;
      continue;
    }
    submissions.push({
      id: row.id,
      formName: row.form_name,
      projectName: row.projects?.name ?? null,
      name: row.name,
      mobile: row.mobile,
      email: row.email,
      source: row.source,
      agentName: row.crm_integrations?.name ?? null,
      crm: {
        status: row.crm_status,
        httpStatus: row.crm_http_status,
        attempts: row.crm_attempts,
        nextRetryAt: row.next_retry_at,
        lastError: row.last_error,
        leadId: row.crm_lead_id,
      },
      answers: toAnswers(row.data, row.form_id ? labels.get(row.form_id) : undefined),
      createdAt: row.created_at,
    });
  }
  return { submissions, skipped };
}

/** Pure: the sources seen, once each, in alphabetical order. */
export function toSources(rows: { source: string | null }[]): string[] {
  return [...new Set(rows.flatMap((row) => (row.source ? [row.source] : [])))].sort(
    (first, second) => first.localeCompare(second),
  );
}
