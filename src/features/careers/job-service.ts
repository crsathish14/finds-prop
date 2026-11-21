import { ActionError } from "@/server/actions/normalise-error";
import type { EmploymentType, JobStatus, WorkMode } from "./constants";
import type { CreateJobInput, JobIdInput, UpdateJobInput } from "./schemas";
import { slugFromTitle, slugWithSuffix, slugWithTail } from "./slug";

/**
 * The rules of the Careers admin (ADR-143, ADR-147), apart from the code that reaches the database so they can be
 * tested with a stand-in. The real store is in `service.ts` and acts as the signed-in admin through their own session:
 * the table's policies let only the super admin write, so nothing here uses the service role. The action has already
 * checked the caller is the super admin and counted the rate limit.
 *
 * The rules the database also holds: a job belongs to a department category (a trigger), a job in Trash is not open
 * (a check), an open job is complete (a check), a job has exactly one way to apply (a check) and a department with
 * jobs cannot be deleted (a foreign key).
 */

/** What the store answers after a write: enough for the caller to refresh the cache and to open the job. */
export interface JobDone {
  jobId: string;
  slug: string;
  status: JobStatus;
  /** Every address this change touched (the old slug too, after a rename), for the cache tags. */
  slugs: string[];
}

/** A job as stored, for the rules that look before they write. */
export interface StoredJob {
  id: string;
  slug: string;
  status: string;
  deletedAt: string | null;
  closesAt: string | null;
  summary: string;
  description: string;
  requirements: string;
}

/** The columns a save writes (the names are the table's). */
export interface JobPatch {
  slug?: string;
  title?: string;
  department_id?: string;
  location?: string;
  work_mode?: WorkMode;
  employment_type?: EmploymentType;
  experience?: string;
  summary?: string;
  description?: string;
  responsibilities?: string;
  requirements?: string;
  salary_note?: string | null;
  apply_url?: string | null;
  apply_email?: string | null;
  closes_at?: string | null;
  status?: JobStatus;
  deleted_at?: string | null;
}

export interface NewJobRow {
  slug: string;
  title: string;
  department_id: string;
  location: string;
  work_mode: WorkMode;
  employment_type: EmploymentType;
  experience: string;
  apply_url: string | null;
  apply_email: string | null;
}

/** Calls made as the signed-in admin. Each throws the database's failure through `mapJobError`. */
export interface JobStore {
  insert(row: NewJobRow): Promise<{ jobId: string; slug: string }>;
  /** The job, or `null` when there is none the admin can see. */
  read(jobId: string): Promise<StoredJob | null>;
  update(jobId: string, patch: JobPatch): Promise<void>;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
}

/**
 * Turns what the database raises into the closed set of action errors. A slug already used is a problem with the slug
 * box; a department that is not in the department list, or does not exist, is a problem with the department box; any
 * other refused value is the form as a whole; a refusal by the policy is the admin gate; a missing job is "not found";
 * anything else is ours and is not repeated.
 */
export function mapJobError(failure: DatabaseFailure): ActionError {
  const { code } = failure;
  if (code === "23505") {
    return new ActionError("VALIDATION", "That slug is already used", {
      fieldErrors: { slug: [{ key: "validation.jobSlugTaken" }] },
    });
  }
  if (code === "23503" || (code === "23514" && /department category/.test(failure.message ?? ""))) {
    return new ActionError("VALIDATION", "That is not a department", {
      fieldErrors: { departmentId: [{ key: "validation.invalid" }] },
    });
  }
  if (code === "23514" || code === "22023") {
    return new ActionError("VALIDATION", "The database refused a value", {
      fieldErrors: { _form: [{ key: "validation.invalid" }] },
    });
  }
  if (code === "P0002" || code === "PGRST116") {
    return new ActionError("NOT_FOUND", "The job was not found");
  }
  if (code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  return new ActionError("INTERNAL", "The job could not be saved");
}

const NOT_FOUND = () => new ActionError("NOT_FOUND", "The job was not found");

function isStatus(value: string): value is JobStatus {
  return value === "draft" || value === "open" || value === "closed";
}

function statusOf(job: StoredJob): JobStatus {
  return isStatus(job.status) ? job.status : "draft";
}

/** How many numbered addresses are tried (`title`, `title-2` ... `title-5`) before a random tail is added. */
const SLUG_ATTEMPTS = 5;

function isSlugTaken(failure: unknown): boolean {
  return failure instanceof ActionError && failure.fieldErrors?.slug !== undefined;
}

/**
 * Makes a draft job. The address is the one typed, or made from the title: a made one that is taken becomes `title-2`,
 * `title-3` and so on (then gets a random tail), while a typed one that is taken is the admin's to change, so it is
 * refused.
 */
export async function createJob(
  store: JobStore,
  input: CreateJobInput,
  randomTail: () => string = () => crypto.randomUUID().slice(0, 4),
): Promise<JobDone> {
  const typed = input.slug !== undefined;
  const base = input.slug ?? (slugFromTitle(input.title) || "job");
  const candidates = typed
    ? [base]
    : Array.from({ length: SLUG_ATTEMPTS + 1 }, (_, index) =>
        index === 0
          ? base
          : index < SLUG_ATTEMPTS
            ? slugWithSuffix(base, index + 1)
            : slugWithTail(base, randomTail()),
      );
  let lastFailure: unknown;
  for (const slug of candidates) {
    try {
      const made = await store.insert({
        slug,
        title: input.title,
        department_id: input.departmentId,
        location: input.location,
        work_mode: input.workMode,
        employment_type: input.employmentType,
        experience: input.experience,
        apply_url: input.applyUrl,
        apply_email: input.applyEmail,
      });
      return { jobId: made.jobId, slug: made.slug, status: "draft", slugs: [made.slug] };
    } catch (failure) {
      if (!isSlugTaken(failure)) throw failure;
      lastFailure = failure;
    }
  }
  throw lastFailure;
}

async function load(store: JobStore, jobId: string): Promise<StoredJob> {
  const job = await store.read(jobId);
  if (!job) throw NOT_FOUND();
  return job;
}

/** A job in Trash is not edited: it is restored first. It reads as not found here, like a foreign id. */
function assertEditable(job: StoredJob): void {
  if (job.deletedAt !== null) throw NOT_FOUND();
}

function done(job: StoredJob, slug: string, status: JobStatus): JobDone {
  return { jobId: job.id, slug, status, slugs: [...new Set([job.slug, slug])] };
}

type Problems = Record<string, { key: string }[]>;

/** What an open job must have; the database checks the same, and the form shows each missing part by its box. */
function missingText(text: {
  summary: string;
  description: string;
  requirements: string;
}): Problems {
  const problems: Problems = {};
  if (text.summary.trim() === "") problems.summary = [{ key: "validation.jobNeedsSummary" }];
  if (text.description.trim() === "") {
    problems.description = [{ key: "validation.jobNeedsDescription" }];
  }
  if (text.requirements.trim() === "") {
    problems.requirements = [{ key: "validation.jobNeedsRequirements" }];
  }
  return problems;
}

/** A closing moment that has already passed would open a job nobody can see. */
function closingProblem(closesAt: string | null, now: Date): Problems {
  return closesAt !== null && new Date(closesAt).getTime() <= now.getTime()
    ? { closesAt: [{ key: "validation.jobClosesPast" }] }
    : {};
}

function refuse(problems: Problems): void {
  if (Object.keys(problems).length > 0) {
    throw new ActionError("VALIDATION", "The job is not ready to open", { fieldErrors: problems });
  }
}

/**
 * Saves what the editor sends. The status and the Trash date are not in it. A job that is open stays complete: the
 * save of an open job is refused, naming the box, when it would empty a part an open job must have.
 */
export async function saveJob(
  store: JobStore,
  input: UpdateJobInput,
  now: () => Date = () => new Date(),
): Promise<JobDone> {
  const job = await load(store, input.jobId);
  assertEditable(job);
  if (statusOf(job) === "open") {
    refuse({ ...missingText(input), ...closingProblem(input.closesAt, now()) });
  }
  await store.update(job.id, {
    slug: input.slug,
    title: input.title,
    department_id: input.departmentId,
    location: input.location,
    work_mode: input.workMode,
    employment_type: input.employmentType,
    experience: input.experience,
    summary: input.summary,
    description: input.description,
    responsibilities: input.responsibilities,
    requirements: input.requirements,
    salary_note: input.salaryNote,
    apply_url: input.applyUrl,
    apply_email: input.applyEmail,
    closes_at: input.closesAt,
  });
  return done(job, input.slug, statusOf(job));
}

/** Puts a job on the site. The first time, the database stamps the posted date. A closed job can be opened again. */
export async function openJob(
  store: JobStore,
  input: JobIdInput,
  now: () => Date = () => new Date(),
): Promise<JobDone> {
  const job = await load(store, input.jobId);
  assertEditable(job);
  refuse({ ...missingText(job), ...closingProblem(job.closesAt, now()) });
  await store.update(job.id, { status: "open" });
  return done(job, job.slug, "open");
}

/** The Close posting button: the job leaves the site and stays in the list as closed. */
export async function closeJob(store: JobStore, input: JobIdInput): Promise<JobDone> {
  const job = await load(store, input.jobId);
  assertEditable(job);
  await store.update(job.id, { status: "closed" });
  return done(job, job.slug, "closed");
}

/** Takes a job off the site and back to a draft. */
export async function unpublishJob(store: JobStore, input: JobIdInput): Promise<JobDone> {
  const job = await load(store, input.jobId);
  assertEditable(job);
  await store.update(job.id, { status: "draft" });
  return done(job, job.slug, "draft");
}

/**
 * Moves a job to Trash. An open job is closed with it (the table refuses an open job in Trash), so restoring it never
 * puts it back on the site: it comes back closed, and opening it again is the admin's choice.
 */
export async function trashJob(
  store: JobStore,
  input: JobIdInput,
  now: () => Date = () => new Date(),
): Promise<JobDone> {
  const job = await load(store, input.jobId);
  if (job.deletedAt !== null) return done(job, job.slug, statusOf(job));
  const status = statusOf(job) === "open" ? "closed" : statusOf(job);
  await store.update(job.id, { status, deleted_at: now().toISOString() });
  return done(job, job.slug, status);
}

/** Brings a job back from Trash as it was (an open one comes back closed). */
export async function restoreJob(store: JobStore, input: JobIdInput): Promise<JobDone> {
  const job = await load(store, input.jobId);
  await store.update(job.id, { deleted_at: null });
  return done(job, job.slug, statusOf(job));
}
