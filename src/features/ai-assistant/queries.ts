import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import type { MonthUse } from "./estimate";

/** One row of the most used web answers: the search words the assistant wrote, never a visitor's message. */
export interface WebAnswerRow {
  readonly query: string;
  readonly timesUsed: number;
  readonly lastUsedAt: string;
}

export interface AiAssistantOverview {
  readonly creditBoughtUsd: number | null;
  readonly month: MonthUse;
  readonly answers: readonly WebAnswerRow[];
}

const overviewSchema = z.object({
  settings: z.object({ creditBoughtUsd: z.coerce.number().nullable() }).nullable(),
  month: z.object({
    messages: z.coerce.number(),
    inputTokens: z.coerce.number(),
    cachedInputTokens: z.coerce.number(),
    outputTokens: z.coerce.number(),
    webSearches: z.coerce.number(),
  }),
  answers: z.array(
    z.object({ query: z.string(), timesUsed: z.coerce.number(), lastUsedAt: z.string() }),
  ),
});

/**
 * The admin AI assistant page's numbers (ADR-218, piece 7), read as the signed-in super admin through
 * `admin_ai_assistant_overview()`, which refuses anyone else: the credit bought, this month's use in India
 * time and the 50 web answers used most. Never cached. A failed or unexpected read is logged by its code and thrown, so
 * the page shows its error state instead of a spend of zero.
 */
export async function getAiAssistantOverview(): Promise<AiAssistantOverview> {
  await connection();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_ai_assistant_overview");
  if (error) {
    logger.error("the AI assistant overview could not be read", { errorCode: error.code });
    throw error;
  }
  const parsed = overviewSchema.safeParse(data);
  if (!parsed.success) {
    logger.error("the AI assistant overview had an unexpected shape");
    throw new Error("The AI assistant overview had an unexpected shape");
  }
  return {
    creditBoughtUsd: parsed.data.settings?.creditBoughtUsd ?? null,
    month: parsed.data.month,
    answers: parsed.data.answers,
  };
}
