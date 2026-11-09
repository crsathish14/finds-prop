import { ActionError } from "@/server/actions/normalise-error";
import type { CreateFormInput, UpdateFormInput } from "./schemas";

/**
 * The rules of the admin's form builder (S7-T08, FR-ADM-08), apart from the code that reaches the database so they
 * can be tested with a stand-in. The real store is in `service.ts` and acts as the signed-in admin through their own
 * session: the table's policies let only the super admin write forms, so nothing here uses the service role. This
 * file turns what the database answers into the closed set of action errors, makes the copy for "Duplicate", and
 * decides what each action answers.
 */

/** The columns of a form the admin writes. */
export interface FormRow {
  name: string;
  slug: string;
  kind: string;
  placement: string;
  project_id: string | null;
  crm_integration_id: string | null;
  button_text: string | null;
  success_message: string | null;
  fields: unknown;
  active: boolean;
}

/** What the store answers after a write: the form's id and the address its pages use. */
export interface FormDone {
  formId: string;
  slug: string;
}

/** Calls made as the signed-in admin. Each throws the database's failure through `mapFormError`. */
export interface FormBuilderStore {
  insert(row: FormRow): Promise<FormDone>;
  update(formId: string, row: FormRow): Promise<FormDone>;
  setActive(formId: string, active: boolean): Promise<FormDone>;
  /** The form as stored, or null when there is none (or the caller may not read it). */
  read(formId: string): Promise<FormRow | null>;
  remove(formId: string): Promise<FormDone>;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
}

/**
 * Turns what the database raises into the closed set of action errors. A slug already used by another form is a
 * problem with the slug box; a refusal by the policy is the admin gate; anything else is ours and is not repeated.
 */
export function mapFormError(failure: DatabaseFailure): ActionError {
  const { code, message } = failure;
  if (code === "23505") {
    return new ActionError("VALIDATION", "That slug is already used by another form", {
      fieldErrors: { slug: [{ key: "validation.formSlugTaken" }] },
    });
  }
  if (code === "23514") {
    return new ActionError("VALIDATION", "The database refused a value", {
      fieldErrors: { _form: [{ key: "validation.invalid" }] },
    });
  }
  if (code === "P0002" || code === "PGRST116") {
    return new ActionError("NOT_FOUND", "The form was not found");
  }
  if (code === "42501" || message === "form.not_allowed") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  return new ActionError("INTERNAL", "The form could not be saved");
}

/** The columns from what the builder sent. A project is kept only when the placement is "one project". */
export function toFormRow(input: CreateFormInput | UpdateFormInput): FormRow {
  return {
    name: input.name,
    slug: input.slug,
    kind: input.kind,
    placement: input.placement,
    project_id: input.placement === "project_specific" ? (input.projectId ?? null) : null,
    crm_integration_id: input.crmIntegrationId ?? null,
    button_text: input.buttonText ?? null,
    success_message: input.successMessage ?? null,
    fields: input.fields,
    active: input.active,
  };
}

export function createForm(store: FormBuilderStore, input: CreateFormInput): Promise<FormDone> {
  return store.insert(toFormRow(input));
}

export function saveForm(store: FormBuilderStore, input: UpdateFormInput): Promise<FormDone> {
  return store.update(input.formId, toFormRow(input));
}

export function switchForm(
  store: FormBuilderStore,
  parameters: { formId: string; active: boolean },
): Promise<FormDone> {
  return store.setActive(parameters.formId, parameters.active);
}

export function deleteFormById(
  store: FormBuilderStore,
  parameters: { formId: string },
): Promise<FormDone> {
  return store.remove(parameters.formId);
}

/** How many numbered slugs "Duplicate" tries before it gives up (copy, copy-2, copy-3 ...). */
export const COPY_TRIES = 6;

/** The copy's name: the original's with " (copy)", cut so it still fits the name's limit. */
export function copyName(name: string, max = 120): string {
  const suffix = " (copy)";
  return `${name.slice(0, max - suffix.length).trimEnd()}${suffix}`;
}

/** The copy's slug on the nth try: `<slug>-copy`, then `<slug>-copy-2` ..., cut to the slug limit. */
export function copySlug(slug: string, attempt: number, max = 80): string {
  const suffix = attempt <= 1 ? "-copy" : `-copy-${attempt}`;
  return `${slug.slice(0, max - suffix.length).replace(/-+$/, "")}${suffix}`;
}

/**
 * "Duplicate": the same form under a new name and slug, switched off, so a copy never goes live by accident. If the
 * slug is taken, the next numbered one is tried. The CRM link and the project come with it.
 */
export async function duplicateForm(
  store: FormBuilderStore,
  parameters: { formId: string },
): Promise<FormDone> {
  const original = await store.read(parameters.formId);
  if (!original) throw new ActionError("NOT_FOUND", "The form was not found");
  for (let attempt = 1; attempt <= COPY_TRIES; attempt += 1) {
    try {
      return await store.insert({
        ...original,
        name: copyName(original.name),
        slug: copySlug(original.slug, attempt),
        active: false,
      });
    } catch (error) {
      const taken = error instanceof ActionError && error.fieldErrors?.["slug"] !== undefined;
      if (!taken || attempt === COPY_TRIES) throw error;
    }
  }
  throw new ActionError("INTERNAL", "The form could not be copied");
}
