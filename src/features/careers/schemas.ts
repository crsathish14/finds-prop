import { z } from "zod";
import {
  EMPLOYMENT_TYPES,
  JOB_APPLY_EMAIL_MAX,
  JOB_APPLY_EMAIL_PATTERN,
  JOB_APPLY_URL_MAX,
  JOB_APPLY_URL_PATTERN,
  JOB_DESCRIPTION_MAX,
  JOB_EXPERIENCE_MAX,
  JOB_LOCATION_MAX,
  JOB_LOCATION_MIN,
  JOB_REQUIREMENTS_MAX,
  JOB_RESPONSIBILITIES_MAX,
  JOB_SALARY_NOTE_MAX,
  JOB_SLUG_MAX,
  JOB_SLUG_MIN,
  JOB_SUMMARY_MAX,
  JOB_TITLE_MAX,
  JOB_TITLE_MIN,
  WORK_MODES,
} from "./constants";

/**
 * What the Careers admin sends (ADR-143, ADR-147). Nothing here says who is saving or what a job's status is: the
 * admin is the signed-in session and each status change is its own action (R-BE-03). A schema message is a key under
 * `validation.*`; the screen looks the words up (ADR-035). The limits match the `job_postings` table's checks, so the
 * database only refuses what the form could not see (a slug already used, a department of another list). Zod only:
 * the browser's editor and the server's action use the same schemas.
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

/** A line of typed text: surrounding spaces and runs of spaces or tabs are tidied, line breaks become spaces. */
const oneLine = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/\s+/g, " ") : typed;

const line = (min: number, max: number) =>
  z.preprocess(
    oneLine,
    z
      .string({ error: "validation.required" })
      .min(min, { error: "validation.required" })
      .max(max, { error: "validation.invalid" }),
  );

/** Text that may be left empty (stored as an empty string). */
const lineOrEmpty = (max: number) =>
  z.preprocess(
    (typed) => (typed === undefined || typed === null ? "" : oneLine(typed)),
    z.string({ error: "validation.invalid" }).max(max, { error: "validation.invalid" }),
  );

/** An optional one-line box: empty means "none" (stored as null). */
const optionalLine = (max: number) =>
  z.preprocess(
    (typed) => {
      const tidied = oneLine(typed);
      return tidied === "" || tidied === undefined ? null : tidied;
    },
    z
      .string({ error: "validation.invalid" })
      .min(1)
      .max(max, { error: "validation.invalid" })
      .nullable(),
  );

/**
 * Paragraphs: line endings are made the same, spaces at the end of a line are dropped and three or more line breaks
 * become one blank line. Nothing is stripped otherwise: the page draws it as text, never as HTML. May be empty.
 */
const paragraphs = (typed: unknown): unknown =>
  typeof typed === "string"
    ? typed
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((row) => row.trimEnd())
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : typed === undefined || typed === null
      ? ""
      : typed;

/** One point per line: each line is tidied and empty lines are dropped. May be empty. */
const points = (typed: unknown): unknown =>
  typeof typed === "string"
    ? typed
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((row) => row.trim().replace(/[ \t]+/g, " "))
        .filter((row) => row !== "")
        .join("\n")
    : typed === undefined || typed === null
      ? ""
      : typed;

const longText = (prepare: (typed: unknown) => unknown, max: number) =>
  z.preprocess(
    prepare,
    z.string({ error: "validation.invalid" }).max(max, { error: "validation.invalid" }),
  );

const slug = z
  .string({ error: "validation.jobSlugInvalid" })
  .trim()
  .min(JOB_SLUG_MIN, { error: "validation.jobSlugInvalid" })
  .max(JOB_SLUG_MAX, { error: "validation.jobSlugInvalid" })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "validation.jobSlugInvalid" });

const title = line(JOB_TITLE_MIN, JOB_TITLE_MAX);
const location = line(JOB_LOCATION_MIN, JOB_LOCATION_MAX);
const workMode = z.enum(WORK_MODES, { error: "validation.invalid" });
const employmentType = z.enum(EMPLOYMENT_TYPES, { error: "validation.invalid" });

/** The apply address: https only, with a host and no sign-in part. Empty means "none". */
const applyUrl = z.preprocess(
  (typed) => {
    const tidied = typeof typed === "string" ? typed.trim() : typed;
    return tidied === "" || tidied === undefined ? null : tidied;
  },
  z
    .string({ error: "validation.jobApplyUrlInvalid" })
    .max(JOB_APPLY_URL_MAX, { error: "validation.jobApplyUrlInvalid" })
    .regex(JOB_APPLY_URL_PATTERN, { error: "validation.jobApplyUrlInvalid" })
    .refine((address) => URL.canParse(address), { error: "validation.jobApplyUrlInvalid" })
    .nullable(),
);

/** The apply email address, kept in lower case. Empty means "none". */
const applyEmail = z.preprocess(
  (typed) => {
    const tidied = typeof typed === "string" ? typed.trim().toLowerCase() : typed;
    return tidied === "" || tidied === undefined ? null : tidied;
  },
  z
    .string({ error: "validation.jobApplyEmailInvalid" })
    .max(JOB_APPLY_EMAIL_MAX, { error: "validation.jobApplyEmailInvalid" })
    .regex(JOB_APPLY_EMAIL_PATTERN, { error: "validation.jobApplyEmailInvalid" })
    .nullable(),
);

/** A job has exactly one way to apply: a link or an email address, never both and never neither. */
const exactlyOneWayToApply = (job: { applyUrl: string | null; applyEmail: string | null }) =>
  (job.applyUrl === null) !== (job.applyEmail === null);
const applyRule = {
  path: ["applyUrl"],
  error: "validation.jobApplyOne",
};

/** The closing moment, as the browser sends it (an ISO date and time with an offset), or empty for "no closing". */
const closesAt = z.preprocess(
  (typed) => (typed === "" || typed === undefined ? null : typed),
  z.iso
    .datetime({ offset: true, error: "validation.invalid" })
    .transform((value) => new Date(value).toISOString())
    .nullable(),
);

const details = {
  title,
  departmentId: uuid,
  location,
  workMode,
  employmentType,
  experience: lineOrEmpty(JOB_EXPERIENCE_MAX),
  applyUrl,
  applyEmail,
};

/** A new job starts as a draft with empty text: the address is made from the title unless the admin typed one. */
export const createJobSchema = z
  .object({ ...details, slug: slug.optional() })
  .refine(exactlyOneWayToApply, applyRule);
export type CreateJobInput = z.infer<typeof createJobSchema>;

/** Saving the editor: everything the admin types, except the status (its own actions). */
export const updateJobSchema = z
  .object({
    jobId: uuid,
    ...details,
    slug,
    summary: lineOrEmpty(JOB_SUMMARY_MAX),
    description: longText(paragraphs, JOB_DESCRIPTION_MAX),
    responsibilities: longText(points, JOB_RESPONSIBILITIES_MAX),
    requirements: longText(points, JOB_REQUIREMENTS_MAX),
    salaryNote: optionalLine(JOB_SALARY_NOTE_MAX),
    closesAt,
  })
  .refine(exactlyOneWayToApply, applyRule);
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

/** Open, close, back to draft, Trash and restore take only the job's id. */
export const jobIdSchema = z.object({ jobId: uuid });
export type JobIdInput = z.infer<typeof jobIdSchema>;
