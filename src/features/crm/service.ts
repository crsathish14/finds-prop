import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/server/supabase/admin.server";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { mapCrmError, type CrmAdminStore, type CrmSendStore } from "./integration-service";
import { CRM_METHODS } from "./constants";

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
          "name, lead_source, base_url, endpoint, method, lead_id_path, headers, body_mapping",
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
