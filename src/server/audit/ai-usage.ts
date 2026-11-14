import "server-only";
import { ActionError } from "../actions/normalise-error";
import { createAdminSupabase } from "../supabase/admin.server";

/**
 * One row of AI chat usage (ADR-128 section 8, decision D8 option A): facts about one customer message, never what
 * was said. There is no field for message text, a phone number, an email, a name or a search word, so none can be
 * written. The shape is the endpoint's `ChatUsageRecord` plus the model that answered; this module does not import
 * the feature (the server layer never imports a feature), so the shape is stated here and the endpoint's record fits it.
 */
export interface AiUsageEvent {
  readonly requestId: string;
  /** When the message arrived (ISO time). */
  readonly at: string;
  readonly caller: "anonymous" | "signed_in";
  /** Set only for a signed-in caller. */
  readonly userId: string | null;
  /** The HMAC visitor hash (never the address), set only for an anonymous caller when it could be worked out. */
  readonly visitorHash: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly promptVersion: string;
  readonly outcome: string;
  readonly limitedBy: string | null;
  readonly inputTags: readonly string[];
  readonly outputTags: readonly string[];
  readonly outputCounts: Readonly<Partial<Record<string, number>>>;
  readonly numberUngrounded: number;
  readonly rounds: number;
  readonly retried: boolean;
  readonly toolCallsPerRound: readonly number[];
  readonly toolsRan: readonly string[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly agentLimit: string | null;
  readonly fallbackReason: string | null;
  readonly durationMs: number;
}

/** A count the database accepts: a whole number, never negative (a bad number is stored as 0, not refused). */
function count(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** The counts of the rule tags as plain numbers; anything that is not a number is dropped. */
function countsOf(counts: AiUsageEvent["outputCounts"]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [name, value] of Object.entries(counts)) {
    if (typeof value === "number") result[name] = count(value);
  }
  return result;
}

/**
 * Writes one usage row through the service role (the table has RLS on and no client grants, so only this module
 * reaches it). It throws `INTERNAL` if the write fails; the endpoint catches that and carries on, so a failed write
 * never changes what the customer gets. Nothing here logs the row.
 */
export async function writeAiUsage(event: AiUsageEvent): Promise<void> {
  const client = createAdminSupabase(event.requestId);
  const { error } = await client.from("ai_usage_events").insert({
    request_id: event.requestId,
    occurred_at: event.at,
    caller: event.caller,
    // The two are never mixed (the table says so too): a signed-in row has a user, an anonymous one a hash.
    user_id: event.caller === "signed_in" ? event.userId : null,
    visitor_hash: event.caller === "anonymous" ? event.visitorHash : null,
    provider: event.provider,
    model: event.model,
    prompt_version: event.promptVersion,
    outcome: event.outcome,
    limited_by: event.limitedBy,
    input_tags: [...event.inputTags],
    output_tags: [...event.outputTags],
    output_counts: countsOf(event.outputCounts),
    number_ungrounded: count(event.numberUngrounded),
    rounds: count(event.rounds),
    retried: event.retried,
    tool_calls_per_round: event.toolCallsPerRound.map(count),
    tools_ran: [...event.toolsRan],
    input_tokens: count(event.inputTokens),
    output_tokens: count(event.outputTokens),
    cached_input_tokens: count(event.cachedInputTokens),
    agent_limit: event.agentLimit,
    fallback_reason: event.fallbackReason,
    duration_ms: count(event.durationMs),
  });
  if (error) throw new ActionError("INTERNAL", "Could not write the usage row");
}
