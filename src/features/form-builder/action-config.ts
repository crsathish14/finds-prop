import { tagsAfterFormChange } from "@/lib/cache-tags";
import {
  createFormSchema,
  deleteFormSchema,
  duplicateFormSchema,
  setFormActiveSchema,
  updateFormSchema,
} from "./schemas";

/**
 * How the admin's form builder actions run, kept apart from the "use server" file so a test can build them (S7-T08).
 * Only a super admin may call them, and each is limited with the admin's other edits (`admin_edit`, 600 an hour: a
 * long session of building forms is well inside it, a stuck script is not). No idempotency key: saving sets values,
 * so a repeat changes nothing more; a second "create" with the same slug is refused by the database (the slug is
 * unique); a second "duplicate" makes the next numbered copy, which is what was asked for; a second delete finds
 * nothing to delete. A form is drawn on the contact page and on project pages, so every change refreshes the forms'
 * cache tag. The database audits a deleted form (`form.deleted`, with the admin as the actor); creating, saving and
 * switching a form are the admin's own content work and have no audit entry, as the other content editors.
 */
const refresh = (): string[] => tagsAfterFormChange();

export const createFormConfig = {
  name: "createForm",
  input: createFormSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const updateFormConfig = {
  name: "updateForm",
  input: updateFormSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const setFormActiveConfig = {
  name: "setFormActive",
  input: setFormActiveSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const duplicateFormConfig = {
  name: "duplicateForm",
  input: duplicateFormSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};

export const deleteFormConfig = {
  name: "deleteForm",
  input: deleteFormSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: refresh,
};
