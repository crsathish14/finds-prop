import "server-only";
import { createAdminSupabase } from "../supabase/admin.server";
import { logger } from "../logger";

/**
 * The place search usage count (ADR-134; the route that calls this is in ADR-133): one call that reached Ola Maps adds one to a row of
 * `places_usage_daily`, through the service-only `record_places_call()`. The record holds three short values from
 * closed lists and nothing else: there is no field for typed text, a place name, a visitor hash, a user id or an
 * address, so none can be written. The database checks the three values again.
 */
export type PlacesUsageApi = "autocomplete";
/** Who asked. `ai_chat` is the AI assistant's place search (ADR-142); the autocomplete route never sets it. */
export type PlacesUsageCaller = "search_box" | "listing_form" | "admin_picker" | "ai_chat";
export type PlacesUsageOutcome = "ok" | "empty" | "timeout" | "quota" | "error";

export interface PlacesUsageRecord {
  readonly api: PlacesUsageApi;
  readonly caller: PlacesUsageCaller;
  readonly outcome: PlacesUsageOutcome;
}

/**
 * Adds one to today's count for this API, caller and outcome. It never throws: counting is a side effect of a place
 * lookup and must never change what the visitor gets, so a failure (no service key, the database not answering, the
 * function refusing a value) is one log line with no input values, and the call is simply not counted (R-BE-10).
 * Only the three listed fields are sent, whatever else a caller passes.
 */
export async function writePlacesUsage(
  record: PlacesUsageRecord,
  requestId?: string,
): Promise<void> {
  try {
    const client = createAdminSupabase(requestId);
    const { error } = await client.rpc("record_places_call", {
      p_api: record.api,
      p_caller: record.caller,
      p_outcome: record.outcome,
    });
    if (error) {
      logger.warn("places usage write failed", {
        route: "places-usage",
        ...(requestId ? { requestId } : {}),
        reason: "rejected",
      });
    }
  } catch (error) {
    logger.warn("places usage write failed", {
      route: "places-usage",
      ...(requestId ? { requestId } : {}),
      reason: "unreachable",
      errorName: error instanceof Error ? error.name : typeof error,
    });
  }
}
