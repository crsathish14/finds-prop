import "server-only";
import { createTranslator } from "next-intl";
import { after } from "next/server";
import { AI_MESSAGE_HARD_STOP_MS, AI_MESSAGE_TIME_LIMIT_MS } from "@/config/ai";
import { getFeatureFlags } from "@/features/site";
import messages from "@/i18n/messages/en.json";
import type { Translate } from "@/lib/format";
import { chooseAiProvider } from "@/server/ai";
import { writeAiUsage } from "@/server/audit/ai-usage";
import { getSessionView } from "@/server/auth/get-session-view";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { reportError } from "@/server/observability";
import { enforceAiChatRateLimits, requestVisitorHash } from "@/server/rate-limit/rate-limit";
import { AI_CHAT_TOOLS } from "../tools/registry";
import type { ChatDeps, ChatUsageRecord } from "./types";

/**
 * The usage step (ADR-128 section 8, decision D8 option A): one row in `ai_usage_events` per message, written through
 * the service role by `server/audit/ai-usage.ts`. The row is names and numbers only, never message text. The model and
 * provider come from the configuration. A failed write throws; the handler catches it, so it never changes the answer.
 */
async function writeUsage(record: ChatUsageRecord): Promise<void> {
  await writeAiUsage({ ...record, provider: env.AI_PROVIDER ?? null, model: env.AI_MODEL ?? null });
}

/** `after` throws outside a request (and a platform may not support it); the work then simply runs unwatched. */
function keepAlive(work: Promise<unknown>): void {
  try {
    after(work);
  } catch (error) {
    logger.warn("ai chat could not hand work to after", { error });
  }
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
    recordUsage: writeUsage,
    visitorHash: requestVisitorHash,
    keepAlive,
    reportError,
    timing: { timeLimitMs: AI_MESSAGE_TIME_LIMIT_MS, hardStopMs: AI_MESSAGE_HARD_STOP_MS },
  };
}
