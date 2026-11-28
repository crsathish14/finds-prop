import "server-only";
import { ActionError } from "@/server/actions/normalise-error";
import { createServerSupabase } from "@/server/supabase/server";
import type { AiAssistantInput } from "./schemas";

export interface AiAssistantSaved {
  readonly creditBoughtUsd: number | null;
}

/**
 * Saves the credit bought (ADR-218, piece 7) as the signed-in super admin, on the one row of `ai_assistant_settings`;
 * row security lets only the super admin change it. Who saved comes from the session, never from the form.
 */
export async function saveAiAssistantSettings(
  input: AiAssistantInput,
  adminId: string,
): Promise<AiAssistantSaved> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("ai_assistant_settings")
    .update({
      credit_bought_usd: input.creditBoughtUsd,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    })
    .eq("id", 1)
    .select("credit_bought_usd")
    .maybeSingle();
  if (error) throw error;
  if (data === null) throw new ActionError("FORBIDDEN", "Only the super admin may change this.");
  return { creditBoughtUsd: data.credit_bought_usd };
}
