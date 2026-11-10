import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { toCrmIntegrationViews, type CrmIntegrationView } from "./view";

/**
 * Every CRM connection, by name, for the admin's CRM page (S7-T09, FR-ADM-09). One call to `admin_crm_integrations()`,
 * made as the signed-in admin: the function checks that itself and refuses anyone else, and it returns for each secret
 * only whether it is set (BR-64). Never cached. A failed read throws, so the portal's error page shows it.
 */
export async function readCrmIntegrations(
  supabase: SupabaseClient<Database>,
): Promise<CrmIntegrationView[]> {
  const { data, error } = await supabase.rpc("admin_crm_integrations");
  if (error) {
    logger.error("the CRM connections could not be read", { errorCode: error.code });
    throw error;
  }
  const { integrations, skipped } = toCrmIntegrationViews(data);
  if (skipped > 0) logger.warn("CRM connection rows could not be read", { skipped });
  return integrations;
}

export async function getCrmIntegrations(): Promise<CrmIntegrationView[]> {
  return readCrmIntegrations(await createServerSupabase());
}
