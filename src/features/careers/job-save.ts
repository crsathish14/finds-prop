import type { JobFormValues } from "@/components/domain/job-form-fields";
import type { ActionFailure, ActionResult } from "@/types/action";
import type { EmploymentType, WorkMode } from "./constants";
import type { JobDone } from "./job-service";
import { slugFromTitle } from "./slug";

/**
 * Saving the Careers editor as one flow (ADR-143, ADR-147), apart from the screen so it can be tested with stand-ins.
 *
 * A new job is made first (a draft with the title, department, place, work mode, type, experience and the way to
 * apply), then everything else is saved with the update, so one press of Save leaves the whole form stored. If the
 * update fails after the job was made, the job exists: the next save updates it instead of making a second one. The
 * server decides on every word; nothing here is believed by it.
 */

/** The closing date is typed and shown in India time, as everywhere on the site. */
const INDIA_OFFSET = "+05:30";

/** A stored moment as the browser's date and time box writes it ("2026-12-31T18:00"), in India time; "" for none. */
export function closesAtToInput(iso: string | null): string {
  if (iso === null) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** The box's text as a moment with an offset (what the action asks for); "" stays empty, a bad text stays as typed. */
export function closesAtFromInput(text: string): string {
  const typed = text.trim();
  if (typed === "") return "";
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(typed) ? `${typed}:00${INDIA_OFFSET}` : typed;
}

export type NewJobInput = {
  title: string;
  slug?: string;
  departmentId: string;
  location: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  experience: string;
  applyUrl: string | null;
  applyEmail: string | null;
};

export type UpdateJobFields = NewJobInput & {
  jobId: string;
  slug: string;
  summary: string;
  description: string;
  responsibilities: string;
  requirements: string;
  salaryNote: string | null;
  closesAt: string | null;
};

export type JobEditorActions = {
  create: (input: NewJobInput) => Promise<ActionResult<JobDone>>;
  update: (input: UpdateJobFields) => Promise<ActionResult<JobDone>>;
};

export type JobSaveStep = "create" | "update";

export type JobSaveResult =
  | { ok: true; jobId: string; slug: string; created: boolean }
  | {
      ok: false;
      step: JobSaveStep;
      /** The job's id when it exists now (made by this save or before it), so the next save updates it. */
      jobId: string | null;
      /** The address the job was made with. */
      slug: string | null;
      failure: ActionFailure;
    };

/** The way to apply as the two columns hold it: the chosen kind's box, the other one empty. */
function applyOf(values: JobFormValues): Pick<NewJobInput, "applyUrl" | "applyEmail"> {
  return values.applyKind === "link"
    ? { applyUrl: values.applyUrl.trim() || null, applyEmail: null }
    : { applyUrl: null, applyEmail: values.applyEmail.trim() || null };
}

function basicsOf(values: JobFormValues): Omit<NewJobInput, "slug"> {
  return {
    title: values.title,
    departmentId: values.departmentId,
    location: values.location,
    workMode: values.workMode,
    employmentType: values.employmentType,
    experience: values.experience,
    ...applyOf(values),
  };
}

export async function saveJobForm(input: {
  /** The job's id, or null for one that is not made yet. */
  jobId: string | null;
  values: JobFormValues;
  actions: JobEditorActions;
}): Promise<JobSaveResult> {
  const { values, actions } = input;
  let jobId = input.jobId;
  let slug = values.slug.trim();
  let created = false;

  if (jobId === null) {
    const typedSlug = slug === "" ? {} : { slug };
    const made = await actions.create({ ...basicsOf(values), ...typedSlug });
    if (!made.ok) return { ok: false, step: "create", jobId: null, slug: null, failure: made };
    jobId = made.data.jobId;
    slug = made.data.slug;
    created = true;
  }
  if (slug === "") slug = slugFromTitle(values.title);

  const saved = await actions.update({
    ...basicsOf(values),
    jobId,
    slug,
    summary: values.summary,
    description: values.description,
    responsibilities: values.responsibilities,
    requirements: values.requirements,
    salaryNote: values.salaryNote.trim() || null,
    closesAt: closesAtFromInput(values.closesAt) || null,
  });
  if (!saved.ok) return { ok: false, step: "update", jobId, slug, failure: saved };
  return { ok: true, jobId, slug: saved.data.slug, created };
}
