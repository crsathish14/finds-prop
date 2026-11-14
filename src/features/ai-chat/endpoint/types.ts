import type { Translate } from "@/lib/format";
import type { AiProvider } from "@/server/ai";
import type { SessionView } from "@/server/auth/session";
import type { ErrorContext } from "@/server/observability";
import type { AiChatRateLimitScope } from "@/server/rate-limit/rate-limit";
import type { AgentFallbackReason, AgentLimit } from "../agent-types";
import type { InputTag } from "../guards/input";
import type { OutputTag } from "../guards/output";
import type { AnyAiChatTool } from "../tools/types";
import type { ChatOutcome } from "./events";

/**
 * One row of usage for one customer message (ADR-128 section 8): facts about the call and never what was said.
 * It has no message text, no phone, no email, no name and no search words; the rule tags and counts are names and
 * numbers only. `userId` and `visitorHash` are for the table `ai_usage_events` (P4-T05) and are never logged.
 */
export interface ChatUsageRecord {
  readonly requestId: string;
  readonly at: string;
  readonly caller: "anonymous" | "signed_in";
  readonly userId: string | null;
  /** The HMAC visitor hash (never the address) of an anonymous caller, when it could be worked out; else null. */
  readonly visitorHash: string | null;
  readonly promptVersion: string;
  readonly outcome: ChatOutcome;
  /** The limit that refused the message, when one did. */
  readonly limitedBy: AiChatRateLimitScope | null;
  readonly inputTags: readonly InputTag[];
  readonly outputTags: readonly OutputTag[];
  readonly outputCounts: Readonly<Partial<Record<OutputTag, number>>>;
  /** Figures the number-grounding rule would have flagged (shadow mode: counted, never acted on). */
  readonly numberUngrounded: number;
  readonly rounds: number;
  readonly retried: boolean;
  readonly toolCallsPerRound: readonly number[];
  readonly toolsRan: readonly string[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
  readonly agentLimit: AgentLimit | null;
  readonly fallbackReason: AgentFallbackReason | null;
  readonly durationMs: number;
}

/**
 * Everything the endpoint needs from outside, so the whole thing can be tested with the fake provider and
 * in-memory stand-ins and no network (`deps.ts` builds the real one).
 */
export interface ChatDeps {
  /** Whether `FLAG_AI_SEARCH` is on. Off means the endpoint answers 404. */
  isEnabled(): boolean;
  /** The signed-in user from the verified token, or null. Never from the request body. */
  getSession(): Promise<SessionView | null>;
  /** Counts the message against the limits; throws `RateLimitedError` when one is used up, any other error to fail closed. */
  enforceLimits(parameters: {
    session: SessionView | null;
    requestId: string;
    scopes?: readonly AiChatRateLimitScope[];
  }): Promise<void>;
  /** The model provider; throws when it is not configured. Called before any limit is spent. */
  createProvider(): AiProvider;
  readonly tools: readonly AnyAiChatTool[];
  readonly translate: Translate;
  /** The usage step. A failure here is logged and never changes what the customer gets. */
  recordUsage(record: ChatUsageRecord): Promise<void>;
  /** The visitor hash of the request (HMAC, never the address), or null if it cannot be worked out. Must not throw. */
  visitorHash?(headers: Headers): string | null;
  /**
   * Keeps the serverless function alive until `work` settles, so a message the customer cancelled still gets its usage
   * recorded (`after` from `next/server` in the real deps). Absent in tests. Must not throw.
   */
  keepAlive?(work: Promise<unknown>): void;
  reportError?(error: unknown, context: ErrorContext): Promise<void>;
  /** The time limit for the whole message and the hard stop, in milliseconds (`src/config/ai.ts`). */
  readonly timing: { readonly timeLimitMs: number; readonly hardStopMs: number };
}
