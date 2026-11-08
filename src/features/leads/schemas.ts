import { z } from "zod";
import {
  CRM_FILTERS,
  DEFAULT_SUBMISSION_RANGE,
  LEAD_STATE_FILTERS,
  LEAD_STATUSES,
  SOURCE_MAX,
  SUBMISSION_RANGES,
} from "./constants";

/**
 * What the admin's Leads page sends (S7-T07, FR-ADM-06). A schema message is a key under `validation.*`; the screen
 * looks the words up (ADR-035). Nothing here says who is asking: the admin is the session.
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

/** One lead's new state: the only column of a lead that can be changed (BR-47). */
export const setLeadStatusSchema = z.object({
  leadId: uuid,
  status: z.enum(LEAD_STATUSES, { error: "validation.invalid" }),
});
export type SetLeadStatusInput = z.infer<typeof setLeadStatusSchema>;

const clean = (typed: unknown): unknown => {
  const first = Array.isArray(typed) ? typed[0] : typed;
  return typeof first === "string" ? first.trim() : undefined;
};

const optionalUuid = z
  .preprocess(
    clean,
    z.uuid().transform((value) => value.toLowerCase()),
  )
  .optional()
  .catch(undefined);

const cursor = z.preprocess(clean, z.string().min(1).max(300)).optional().catch(undefined);

/**
 * The Leads page's address bar and its "Show more": a project, a state and the page cursor. A value that is not
 * valid is dropped, so a mistyped address shows the whole list instead of an error.
 */
export const leadFilterSchema = z.object({
  project: optionalUuid,
  status: z.preprocess(clean, z.enum(LEAD_STATE_FILTERS)).catch("all"),
  after: cursor,
});
export type LeadFilters = z.infer<typeof leadFilterSchema>;

/**
 * The form submissions' address bar and "Show more": the date range, the form, the project, the source, the CRM
 * state and the page cursor. Anything not valid is dropped, as above.
 */
export const submissionFilterSchema = z.object({
  range: z.preprocess(clean, z.enum(SUBMISSION_RANGES)).catch(DEFAULT_SUBMISSION_RANGE),
  form: optionalUuid,
  project: optionalUuid,
  source: z.preprocess(clean, z.string().min(1).max(SOURCE_MAX)).optional().catch(undefined),
  crm: z.preprocess(clean, z.enum(CRM_FILTERS)).catch("any"),
  after: cursor,
});
export type SubmissionFilters = z.infer<typeof submissionFilterSchema>;
