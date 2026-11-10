import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrmEditor, getCrmIntegrations, saveCrmIntegration } from "@/features/crm";
import { getTranslate } from "@/features/site";
import { getProjectOptions } from "@/features/units";

type PageProps = { params: Promise<{ id: string }> };

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.crm.metaTitleEdit") };
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The admin's edit CRM connection page (S7-T09, FR-ADM-09): the editor filled with what is stored. An address that is
 * not a connection id, or a connection that does not exist, is "not found". Read as the signed-in admin and never
 * cached, so the editor opens with what is stored; no secret is read, only whether each is set (BR-64). The role gate
 * in the layout has already sent anyone else away.
 */
export default async function EditCrmConnectionPage({ params }: PageProps) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const [connections, projects] = await Promise.all([getCrmIntegrations(), getProjectOptions()]);
  const integration = connections.find((candidate) => candidate.id === id.toLowerCase());
  if (!integration) notFound();
  return <CrmEditor integration={integration} projects={projects} save={saveCrmIntegration} />;
}
