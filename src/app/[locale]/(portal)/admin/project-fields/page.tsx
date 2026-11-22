import type { Metadata } from "next";
import {
  getProjectFieldsPage,
  ProjectFieldsForm,
  saveProjectFields,
} from "@/features/site-content";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.projectFields.metaTitle") };
}

/**
 * The admin's Project form boxes page (ADR-168): the extra text boxes builders see on the project form. It opens on what
 * is saved, read as the signed-in admin and never cached; the role gate in the layout has already sent anyone else away.
 */
export default async function ProjectFieldsPage() {
  const { initial } = await getProjectFieldsPage();
  return (
    <ProjectFieldsForm key={JSON.stringify(initial)} initial={initial} save={saveProjectFields} />
  );
}
