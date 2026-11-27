import type { Translate } from "@/lib/format";
import type { AiProvider } from "@/server/ai";
import type { SessionView } from "@/server/auth/session";
import type { ErrorContext } from "@/server/observability";
import type { AiChatRateLimitScope } from "@/server/rate-limit/rate-limit";
import type { AgentFallbackReason, AgentLimit } from "../agent-types";
import type { InputTag } from "../guards/input";
import type { OutputTag } from "../guards/output";
import type { ContextReads } from "../context/resolve";
import type { ConfirmCard } from "../confirm/confirm-card";
import type { ProposalOffer } from "../tools/proposal-offer";
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
  /** Paid web searches this message ran (ADR-218), for the estimated spend. A number only. */
  readonly webSearches: number;
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
  /**
   * The web search (ADR-218): its tool, offered to a signed-in customer only while `isOn` says the admin's Web search
   * switch is on. `isOn` is asked on every message, so a change shows at once; when it fails the search is off. Absent
   * means there is no web search (the fake provider, tests).
   */
  readonly webSearch?: {
    readonly tool: AnyAiChatTool;
    isOn(): Promise<boolean>;
  };
  /**
   * True when `tools` holds the place-aware search (`FLAG_AI_PLACE_SEARCH` with `FLAG_AI_SEARCH`, ADR-142), so the
   * system prompt carries the rules for places. Absent or false: the prompt and the tool are as they were before.
   */
  readonly placeSearch?: boolean;
  readonly translate: Translate;
  /**
   * Builds the confirm card for a propose tool's offer, for the caller of this request (AI-P6-T02). Absent in tests
   * that have no cards. Must not throw; null means no card.
   */
  confirmCard?(offer: ProposalOffer, session: SessionView | null): Promise<ConfirmCard | null>;
  /**
   * The reads that check the page context's ids against what is listed now (AI-P7-T01). Absent means the request's
   * context is ignored. A read that throws gives no context, never an error.
   */
  readonly contextReads?: ContextReads;
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
