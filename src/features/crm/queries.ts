import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { CRM_LOGS_LIMIT } from "./constants";
import { toCrmLogViews, type CrmLogsPage } from "./logs-view";
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

const LOG_COLUMNS =
  "id, created_at, integration_name, form_name, outcome, http_status, attempt, response_snippet, submission_id";

/**
 * The admin's API logs (S7-T09, FR-ADM-09): the newest lines of the delivery log, and how many form submissions are
 * failed right now (the number on the tab). Read as the signed-in admin through their own session: the policies of
 * `crm_api_logs` and `form_submissions` let an admin read them and show anyone else nothing. Never cached. For the
 * submissions the lines name, one more read says which are still failed, so Retry is offered only on the newest line
 * of such a submission. A failed read throws, so the portal's error page shows it.
 */
export async function readCrmLogs(supabase: SupabaseClient<Database>): Promise<CrmLogsPage> {
  const [lines, failed] = await Promise.all([
    supabase
      .from("crm_api_logs")
      .select(LOG_COLUMNS)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(CRM_LOGS_LIMIT),
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("crm_status", "failed"),
  ]);
  if (lines.error) {
    logger.error("the CRM logs could not be read", { errorCode: lines.error.code });
    throw lines.error;
  }
  if (failed.error) {
    logger.error("the failed CRM deliveries could not be counted", {
      errorCode: failed.error.code,
    });
    throw failed.error;
  }
  const named = [
    ...new Set(lines.data.flatMap((line) => (line.submission_id ? [line.submission_id] : []))),
  ];
  let stillFailed = new Set<string>();
  if (named.length > 0) {
    const rows = await supabase
      .from("form_submissions")
      .select("id")
      .in("id", named)
      .eq("crm_status", "failed");
    if (rows.error) {
      logger.error("the CRM delivery states could not be read", { errorCode: rows.error.code });
      throw rows.error;
    }
    stillFailed = new Set(rows.data.map((row) => row.id));
  }
  const { logs, skipped } = toCrmLogViews(lines.data, stillFailed);
  if (skipped > 0) logger.warn("CRM log rows could not be read", { skipped });
  return { logs, failedSubmissions: failed.count ?? 0 };
}

export async function getCrmLogs(): Promise<CrmLogsPage> {
  return readCrmLogs(await createServerSupabase());
}
