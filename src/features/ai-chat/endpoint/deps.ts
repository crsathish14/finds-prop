import "server-only";
import { createTranslator } from "next-intl";
import { AI_MESSAGE_HARD_STOP_MS, AI_MESSAGE_TIME_LIMIT_MS } from "@/config/ai";
import { getFeatureFlags } from "@/features/site";
import messages from "@/i18n/messages/en.json";
import type { Translate } from "@/lib/format";
import { chooseAiProvider } from "@/server/ai";
import { getSessionView } from "@/server/auth/get-session-view";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { reportError } from "@/server/observability";
import { enforceAiChatRateLimits } from "@/server/rate-limit/rate-limit";
import { AI_CHAT_TOOLS } from "../tools/registry";
import type { ChatDeps, ChatUsageRecord } from "./types";

/**
 * The usage step for now: one structured line per message, names and numbers only. The table that keeps these rows
 * comes with the next task (P4-T05, decision D8) and replaces this function; the record is already its row.
 * `userId` is not written to the line: the line says only whether the caller was signed in.
 */
async function logUsage(record: ChatUsageRecord): Promise<void> {
  const fields = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "userId"));
  logger.info("ai chat usage", fields);
}

/** The words of the fixed replies, from the English catalogue: the assistant's wording is not chosen per page or locale. */
const translate = createTranslator({ locale: "en", messages }) as unknown as Translate;

/** The real dependencies of the endpoint. */
export function createChatDeps(): ChatDeps {
  return {
    isEnabled: () => getFeatureFlags().aiSearch,
    getSession: getSessionView,
    enforceLimits: enforceAiChatRateLimits,
    createProvider: () => chooseAiProvider(env.AI_PROVIDER ?? ""),
    tools: AI_CHAT_TOOLS,
    translate,
    recordUsage: logUsage,
    reportError,
    timing: { timeLimitMs: AI_MESSAGE_TIME_LIMIT_MS, hardStopMs: AI_MESSAGE_HARD_STOP_MS },
  };
}
