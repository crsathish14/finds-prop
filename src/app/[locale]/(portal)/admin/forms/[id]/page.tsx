import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EDITOR_LISTS, FormEditor, getFormBuilderData, updateForm } from "@/features/form-builder";
import { getTranslate } from "@/features/site";

type PageProps = { params: Promise<{ id: string }> };

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.forms.metaTitleEdit") };
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The admin's edit form page (S7-T08, FR-ADM-08): the editor filled with what is stored. An address that is not a form
 * id, or a form that does not exist, is "not found". Read as the signed-in admin and never cached, so the editor
 * opens with what is stored; the role gate in the layout has already sent anyone else away.
 */
export default async function EditFormPage({ params }: PageProps) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const { forms, projects, integrations } = await getFormBuilderData();
  const form = forms.find((candidate) => candidate.id === id.toLowerCase());
  if (!form) notFound();
  return (
    <FormEditor
      form={form}
      projects={projects}
      integrations={integrations}
      lists={EDITOR_LISTS}
      save={updateForm}
    />
  );
}
