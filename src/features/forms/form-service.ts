import { ActionError } from "@/server/actions/normalise-error";
import {
  formFieldsSchema,
  type FormDefinition,
  type SubmitFormInput,
  type SubmitProjectFormInput,
} from "./schemas";
import { validateSubmission, type ValidSubmission } from "./validate";

/**
 * The write side of a form (S5-T05), apart from the code that reaches the database so the rules can be
 * tested with stand-ins. The real store and the form read are in `service.ts`.
 */

/** The columns of a form a visitor may read: never the CRM link (the database grants no more). */
export const FORM_COLUMNS =
  "slug, name, kind, placement, project_id, button_text, success_message, fields";

/** One submission as the database function takes it. */
export interface SubmissionRow {
  formSlug: string;
  visitor: string;
  submission: ValidSubmission;
  source: string | null;
  projectSlug: string | null;
  idempotencyKey: string;
}

export interface FormWriteStore {
  /** Reads an active form a visitor may see, or null when there is none. Throws when the read fails. */
  readForm(slug: string): Promise<{ row: unknown; found: boolean }>;
  /** Stores the submission and returns its id. Throws an `ActionError` when the database refuses it. */
  insertSubmission(row: SubmissionRow): Promise<string>;
}

/** The write side for a project's form: the same store, and the read of the form a project shows. */
export interface ProjectFormWriteStore extends FormWriteStore {
  /** Reads the form a project page shows (BR-49), or null when it shows none. Throws when the read fails. */
  readProjectForm(projectSlug: string): Promise<{ row: unknown; found: boolean }>;
}

/** What the database says when a call fails: the error code and the message the function raised. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/**
 * Turns what `record_form_submission` raises into the closed set of action errors. A form that is not
 * active or not shown anywhere is "not found"; a value the table refuses is a validation problem;
 * anything else is our bug, so it is internal.
 */
export function mapFormWriteError(failure: DatabaseFailure): ActionError {
  if (failure.code === "P0002") return new ActionError("NOT_FOUND", "The form is not open");
  if (failure.code === "23514") {
    return new ActionError("VALIDATION", "The database refused a value", {
      fieldErrors: { _form: [{ key: "validation.invalid" }] },
    });
  }
  return new ActionError("INTERNAL", "The form write failed");
}

/** Reads a stored form row into the shape the rules use, or null when its fields do not fit. */
export function parseFormRow(row: unknown): FormDefinition | null {
  if (typeof row !== "object" || row === null) return null;
  const stored = row as Record<string, unknown>;
  const fields = formFieldsSchema.safeParse(stored["fields"]);
  if (!fields.success || typeof stored["slug"] !== "string" || typeof stored["name"] !== "string") {
    return null;
  }
  return {
    slug: stored["slug"],
    name: stored["name"],
    kind: stored["kind"] as FormDefinition["kind"],
    placement: stored["placement"] as FormDefinition["placement"],
    projectId: typeof stored["project_id"] === "string" ? stored["project_id"] : null,
    buttonText: typeof stored["button_text"] === "string" ? stored["button_text"] : null,
    successMessage:
      typeof stored["success_message"] === "string" ? stored["success_message"] : null,
    fields: fields.data,
  };
}

/**
 * Stores a submission for a form. The form is read from the database by the slug (the visitor names it,
 * the server decides what it contains), the answers are checked against its stored fields (BR-60), and
 * only then is the function called. A form that is not there is "not found", a stored definition that
 * does not fit is our bug (internal), and wrong answers come back as field errors with nothing stored.
 */
export async function submitFormValues(
  store: FormWriteStore,
  parameters: { input: SubmitFormInput; visitor: string },
): Promise<{ submissionId: string }> {
  const { input } = parameters;
  const read = await store.readForm(input.formSlug);
  if (!read.found) throw new ActionError("NOT_FOUND", "No such form is open");
  const form = parseFormRow(read.row);
  if (!form) throw new ActionError("INTERNAL", "The stored form does not fit its shape");

  const checked = validateSubmission(form.fields, input.values);
  if (!checked.ok) {
    throw new ActionError("VALIDATION", "The answers do not fit the form", {
      fieldErrors: checked.fieldErrors,
    });
  }
  const submissionId = await store.insertSubmission({
    formSlug: form.slug,
    visitor: parameters.visitor,
    submission: checked.submission,
    source: input.source ?? null,
    projectSlug: input.projectSlug ?? null,
    idempotencyKey: input.idempotencyKey,
  });
  return { submissionId };
}

/**
 * Stores a submission of the form a project page shows (S5-T05, change 4). The form is the one the server
 * finds for the project, never one the request names (BR-49), and the answers are checked against its
 * stored fields (BR-60). The mobile is the signed-in account's own phone: it replaces whatever the request
 * carried, so a submission cannot be made for someone else's number. The page it was filled in on is the
 * project's own address.
 */
export async function submitProjectFormValues(
  store: ProjectFormWriteStore,
  parameters: { input: SubmitProjectFormInput; phone: string; visitor: string },
): Promise<{ submissionId: string }> {
  const { input, phone } = parameters;
  const read = await store.readProjectForm(input.projectSlug);
  if (!read.found) throw new ActionError("NOT_FOUND", "This project shows no form");
  const form = parseFormRow(read.row);
  if (!form) throw new ActionError("INTERNAL", "The stored form does not fit its shape");

  const checked = validateSubmission(form.fields, { ...input.values, mobile: phone });
  if (!checked.ok) {
    throw new ActionError("VALIDATION", "The answers do not fit the form", {
      fieldErrors: checked.fieldErrors,
    });
  }
  const submissionId = await store.insertSubmission({
    formSlug: form.slug,
    visitor: parameters.visitor,
    submission: { ...checked.submission, mobile: phone },
    source: "/projects/" + input.projectSlug,
    projectSlug: input.projectSlug,
    idempotencyKey: input.idempotencyKey,
  });
  return { submissionId };
}
