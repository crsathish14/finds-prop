import type { Metadata } from "next";
import { createForm, EDITOR_LISTS, FormEditor, getFormBuilderData } from "@/features/form-builder";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.forms.metaTitleNew") };
}

/**
 * The admin's new form page (S7-T08, FR-ADM-08): the editor with empty boxes. The projects and CRM integrations the
 * pickers offer are read as the signed-in admin. Once the form is made, the editor opens it on its own page.
 */
export default async function NewFormPage() {
  const { projects, integrations } = await getFormBuilderData();
  return (
    <FormEditor
      form={null}
      projects={projects}
      integrations={integrations}
      lists={EDITOR_LISTS}
      save={createForm}
    />
  );
}
