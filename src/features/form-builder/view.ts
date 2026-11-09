import { FORM_KINDS, FORM_PLACEMENTS, formFieldSchema } from "@/features/forms";
import type { FormField } from "@/features/forms";

/**
 * One form as the admin's list and editor use it (S7-T08, FR-ADM-08): the stored form with the names of the project
 * and the CRM integration it points at, and its fields as the pages draw them.
 */
export interface AdminFormView {
  id: string;
  name: string;
  slug: string;
  kind: (typeof FORM_KINDS)[number];
  placement: (typeof FORM_PLACEMENTS)[number];
  projectId: string | null;
  projectName: string | null;
  crmIntegrationId: string | null;
  crmName: string | null;
  buttonText: string | null;
  successMessage: string | null;
  active: boolean;
  /** The fields the pages can draw. */
  fields: FormField[];
  /** Stored fields that do not fit the shape (a hand-made change); they are left out of `fields` and counted. */
  skippedFields: number;
}

/** What the editor offers in its pickers. */
export interface FormBuilderOptions {
  projects: { id: string; name: string }[];
  integrations: { id: string; name: string }[];
}

type StoredForm = {
  id: string;
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
};

const oneOf = <Value extends string>(
  known: readonly Value[],
  value: string,
  fallback: Value,
): Value => known.find((candidate) => candidate === value) ?? fallback;

/** The stored fields that fit the shape, and how many did not. */
export function readFields(stored: unknown): { fields: FormField[]; skipped: number } {
  if (!Array.isArray(stored)) return { fields: [], skipped: 0 };
  const fields: FormField[] = [];
  let skipped = 0;
  for (const raw of stored) {
    const parsed = formFieldSchema.safeParse(raw);
    if (parsed.success) fields.push(parsed.data);
    else skipped += 1;
  }
  return { fields, skipped };
}

/** The forms from `admin_forms()`, newest change first, with the names their ids point at. */
export function toAdminForms(
  rows: readonly StoredForm[],
  options: FormBuilderOptions,
): AdminFormView[] {
  const projects = new Map(options.projects.map((project) => [project.id, project.name]));
  const integrations = new Map(options.integrations.map((entry) => [entry.id, entry.name]));
  return rows.map((row) => {
    const { fields, skipped } = readFields(row.fields);
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      kind: oneOf(FORM_KINDS, row.kind, "enquiry"),
      placement: oneOf(FORM_PLACEMENTS, row.placement, "none"),
      projectId: row.project_id,
      projectName: row.project_id ? (projects.get(row.project_id) ?? null) : null,
      crmIntegrationId: row.crm_integration_id,
      crmName: row.crm_integration_id ? (integrations.get(row.crm_integration_id) ?? null) : null,
      buttonText: row.button_text,
      successMessage: row.success_message,
      active: row.active,
      fields,
      skippedFields: skipped,
    };
  });
}
