import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/server/supabase/admin.server";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapCrmError, type CrmAdminStore, type CrmSendStore } from "./integration-service";
import { CRM_METHODS, RETRY_TOKEN_NAME } from "./constants";
import type { DeliveryStore, DueDelivery } from "./delivery";

/**
 * The CRM connections reach the database here (S7-T09). Two kinds of access live in this file and must not be mixed up:
 *
 *  - the admin's own, through their cookies (`createCrmAdminStore`): saving and deleting a connection. `save_crm_
 *    integration` checks for itself that the caller is a super admin and writes the secrets in the same transaction;
 *    the audit triggers then record the change with the admin as the actor. Nothing returns a secret.
 *  - the server's, with the service role (`createCrmSendStore`): reading a connection WITH its secrets to send a
 *    test lead, and writing the delivery log line. The secrets table is closed to everyone else (BR-64). The only
 *    callers are actions built with `defineAction`, which have already checked that the caller is the super admin.
 */
export async function createCrmAdminStore(): Promise<CrmAdminStore> {
  return crmAdminStore(await createServerSupabase());
}

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function crmAdminStore(supabase: SupabaseClient<Database>): CrmAdminStore {
  return {
    async save(row, integrationId, secrets) {
      const { data, error } = await supabase.rpc("save_crm_integration", {
        p_values: row,
        p_secrets: secrets,
        ...(integrationId === null ? {} : { p_integration: integrationId }),
      });
      if (error || !data) throw mapCrmError(error ?? {});
      return { integrationId: data };
    },

    async remove(integrationId) {
      const { data, error } = await supabase
        .from("crm_integrations")
        .delete()
        .eq("id", integrationId)
        .select("id");
      if (error) throw mapCrmError(error);
      const found = data[0];
      // Nothing deleted: no such connection, or the policy hid it from this caller.
      if (!found) throw mapCrmError({ code: "P0002" });
      return { integrationId: found.id };
    },
  };
}

export function createCrmSendStore(requestId?: string): CrmSendStore {
  return crmSendStore(createAdminSupabase(requestId));
}

const textMap = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
};

/** The same store for any service-role client (the integration tests pass theirs). */
export function crmSendStore(supabase: SupabaseClient<Database>): CrmSendStore {
  return {
    async readForSend(integrationId) {
      const { data: connection, error } = await supabase
        .from("crm_integrations")
        .select(
          "name, lead_source, base_url, endpoint, method, lead_id_path, headers, body_mapping, project_codes",
        )
        .eq("id", integrationId)
        .maybeSingle();
      if (error) throw mapCrmError(error);
      if (!connection) return null;
      const { data: stored, error: secretError } = await supabase
        .from("crm_integration_secrets")
        .select("api_key, api_secret, access_token")
        .eq("integration_id", integrationId)
        .maybeSingle();
      if (secretError) throw mapCrmError(secretError);
      const method = CRM_METHODS.find((known) => known === connection.method) ?? "POST";
      return {
        name: connection.name,
        connection: {
          baseUrl: connection.base_url,
          endpoint: connection.endpoint,
          method,
          leadSource: connection.lead_source,
          leadIdPath: connection.lead_id_path,
          headers: textMap(connection.headers),
          bodyMapping: textMap(connection.body_mapping),
        },
        projectCodes: textMap(connection.project_codes),
        secrets: {
          apiKey: stored?.api_key ?? null,
          apiSecret: stored?.api_secret ?? null,
          accessToken: stored?.access_token ?? null,
        },
      };
    },

    async writeLog(entry) {
      const { error } = await supabase.from("crm_api_logs").insert({
        integration_id: entry.integrationId,
        integration_name: entry.integrationName,
        form_name: entry.formName,
        outcome: entry.outcome,
        http_status: entry.httpStatus,
        attempt: entry.attempt,
        response_snippet: entry.snippet,
      });
      if (error) throw mapCrmError(error);
    },
  };
}

/**
 * The delivery engine's calls (S7-T09 part B2), all with the service role: the database's claim and record functions
 * (ADR-114), the connection with its secrets, the retry job's token and the arming of the job. The only callers are
 * the retry route (which has checked its token), the form actions' immediate send, and the admin's retry action
 * (which has checked the role).
 */
export function createDeliveryStore(requestId?: string): DeliveryStore {
  return deliveryStore(createAdminSupabase(requestId));
}

/** The same store for any service-role client (the integration tests pass theirs). */
export function deliveryStore(supabase: SupabaseClient<Database>): DeliveryStore {
  const sender = crmSendStore(supabase);
  return {
    async claim(limit, submissionId) {
      const { data, error } = await supabase.rpc("claim_crm_deliveries", {
        p_limit: limit,
        ...(submissionId === undefined ? {} : { p_submission: submissionId }),
      });
      if (error) throw mapCrmError(error);
      return data.map((row): DueDelivery => ({
        submissionId: row.submission_id,
        integrationId: row.integration_id,
        attempt: row.attempt,
        formName: row.form_name,
        projectId: row.project_id,
        projectName: row.project_name,
        projectSlug: row.project_slug,
        name: row.name,
        mobile: row.mobile,
        email: row.email,
        data: row.data,
        source: row.source,
        createdAt: row.created_at,
      }));
    },

    readConnection: (integrationId) => sender.readForSend(integrationId),

    async record(entry) {
      const { error } = await supabase.rpc("record_crm_delivery", {
        p_submission: entry.submissionId,
        p_integration_name: entry.integrationName,
        p_attempt: entry.attempt,
        p_ok: entry.ok,
        p_snippet: entry.snippet,
        ...(entry.httpStatus === null ? {} : { p_http_status: entry.httpStatus }),
        ...(entry.leadId === null ? {} : { p_lead_id: entry.leadId }),
        ...(entry.nextRetry === null ? {} : { p_next_retry: entry.nextRetry.toISOString() }),
      });
      if (error) throw mapCrmError(error);
    },

    async readToken() {
      const { data, error } = await supabase
        .from("internal_cron_tokens")
        .select("token")
        .eq("name", RETRY_TOKEN_NAME)
        .maybeSingle();
      if (error) throw mapCrmError(error);
      return data?.token ?? null;
    },

    async hasWaiting() {
      const { data: active, error: activeError } = await supabase
        .from("crm_integrations")
        .select("id")
        .eq("active", true);
      if (activeError) throw mapCrmError(activeError);
      if (active.length === 0) return false;
      const { count, error } = await supabase
        .from("form_submissions")
        .select("id", { count: "exact", head: true })
        .in(
          "crm_integration_id",
          active.map((row) => row.id),
        )
        .or("crm_status.eq.pending,and(crm_status.eq.failed,next_retry_at.not.is.null)");
      if (error) throw mapCrmError(error);
      return (count ?? 0) > 0;
    },

    async armRetryJob() {
      const { error } = await supabase.rpc("arm_crm_retry");
      if (error) throw mapCrmError(error);
    },

    async disarmRetryJob() {
      const { error } = await supabase.rpc("disarm_crm_retry");
      if (error) throw mapCrmError(error);
    },
  };
}
