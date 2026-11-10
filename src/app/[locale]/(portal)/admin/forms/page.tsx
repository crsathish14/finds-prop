import type { Metadata } from "next";
import {
  AdminForms,
  deleteForm,
  duplicateForm,
  getFormBuilderData,
  setFormActive,
} from "@/features/form-builder";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.forms.metaTitle") };
}

/**
 * The admin's forms page (S7-T08, FR-ADM-08): every form with its placement, CRM link and Active switch, and Edit,
 * Duplicate and Delete. The forms are read as the signed-in admin (`admin_forms()` checks that itself, and the page is
 * never cached so it is right after every change); the role gate in the layout has already sent anyone else away.
 */
export default async function AdminFormsPage() {
  const { forms } = await getFormBuilderData();
  return (
    <AdminForms
      forms={forms}
      actions={{ setActive: setFormActive, duplicate: duplicateForm, remove: deleteForm }}
    />
  );
}
