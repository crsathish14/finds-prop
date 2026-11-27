import "server-only";
import { ActionError } from "@/server/actions/normalise-error";
import { createServerSupabase } from "@/server/supabase/server";
import type { AiAssistantInput } from "./schemas";

export interface AiAssistantSaved {
  readonly webSearch: boolean;
  readonly creditBoughtUsd: number | null;
}

/**
 * Saves the Web search switch and the credit bought (ADR-218, piece 7) as the signed-in super admin, on the one row of
 * `ai_assistant_settings`; row security lets only the super admin change it. Who saved comes from the session, never
 * from the form. The chat reads the switch on its next message, so the change applies at once.
 */
export async function saveAiAssistantSettings(
  input: AiAssistantInput,
  adminId: string,
): Promise<AiAssistantSaved> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("ai_assistant_settings")
    .update({
      web_search: input.webSearch,
      credit_bought_usd: input.creditBoughtUsd,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    })
    .eq("id", 1)
    .select("web_search, credit_bought_usd")
    .maybeSingle();
  if (error) throw error;
  if (data === null) throw new ActionError("FORBIDDEN", "Only the super admin may change this.");
  return { webSearch: data.web_search, creditBoughtUsd: data.credit_bought_usd };
}
