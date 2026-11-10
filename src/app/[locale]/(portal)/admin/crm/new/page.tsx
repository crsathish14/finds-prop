import type { Metadata } from "next";
import { CrmEditor, saveCrmIntegration } from "@/features/crm";
import { getTranslate } from "@/features/site";
import { getProjectOptions } from "@/features/units";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.crm.metaTitleNew") };
}

/**
 * The admin's new CRM connection page (S7-T09, FR-ADM-09): the editor with empty boxes. The projects the project codes
 * are chosen from are read as the signed-in admin. Once the connection is made, the editor opens it on its own page.
 */
export default async function NewCrmConnectionPage() {
  const projects = await getProjectOptions();
  return <CrmEditor integration={null} projects={projects} save={saveCrmIntegration} />;
}
