import type { Metadata } from "next";
import {
  AdminCrm,
  deleteCrmIntegration,
  getCrmIntegrations,
  getCrmLogs,
  retryCrmDelivery,
  testCrmIntegration,
} from "@/features/crm";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.crm.metaTitle") };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * The admin's CRM page (S7-T09, FR-ADM-09): the connections with Test API, Edit and Delete, and the API logs with
 * Retry. The tab is in the address (`?tab=logs`); a value that is not valid is the connections tab. Everything is
 * read as the signed-in admin (the database functions and policies check that themselves) and is never cached, so
 * the page is right after every change; the role gate in the layout has already sent anyone else away. No secret is
 * read: a connection says only whether each one is set.
 */
export default async function AdminCrmPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [connections, logs] = await Promise.all([getCrmIntegrations(), getCrmLogs()]);
  return (
    <AdminCrm
      tab={first(params.tab) === "logs" ? "logs" : "connections"}
      connections={connections}
      logs={logs}
      actions={{ test: testCrmIntegration, remove: deleteCrmIntegration, retry: retryCrmDelivery }}
    />
  );
}
