/**
 * What goes into the agent loop and what comes out (ADR-128 section 4.5). The loop returns codes and keys,
 * never sentences: the words a customer reads are in `en.json` under `ai`, and the endpoint (P4-T04) turns
 * a key into text with `translate`. Nothing in an event is message text except the answer's own deltas.
 */
import type { AiMessage, AiProvider } from "@/server/ai";
import type { AnyAiChatTool, ToolContext, ToolReference } from "./tools/types";

/** The customer-visible wording the loop points at, as `en.json` keys (approved 13 Nov 2026, gate G-G). */
export const AGENT_MESSAGE_KEYS = {
  /** The one fixed status shown while tools run ("Searching…"). */
  searching: "ai.searching",
  /** Shown after an answer that a limit cut short ("I couldn't check everything. Here is what I found."). */
  capNote: "ai.capNote",
  /** Shown instead of an answer when none could be made; the endpoint adds the link to `/properties`. */
  fallback: "ai.fallback",
} as const;

/**
 * How the message ended:
 * - `answered`: the model answered in its own time.
 * - `limit`: a limit forced the answer-only round and it answered (`limit` says which limit).
 * - `fallback`: no usable answer; show the fixed fallback (`fallbackReason` says why).
 * - `aborted`: the caller cancelled (the customer left, or the function is out of time). Show nothing.
 */
export type AgentOutcome = "answered" | "limit" | "fallback" | "aborted";

/** Which limit forced the answer-only round: `round_cap` and `tool_cap` as in ADR-128 section 4.5, and the time limit. */
export type AgentLimit = "round_cap" | "tool_cap" | "time_limit";

export type AgentFallbackReason = "provider_error" | "refused" | "empty_answer" | "time_limit";

export interface AgentInput {
  readonly provider: AiProvider;
  /** The tools the model may call. A list is passed in so tests can use stand-ins. */
  readonly tools: readonly AnyAiChatTool[];
  /** The system prompt (P4-T03). The loop adds to it only in the answer-only round. */
  readonly system: string;
  /** The recent conversation, ending with the customer's new message. */
  readonly messages: readonly AiMessage[];
  readonly context: ToolContext;
  /**
   * The hard stop: the customer left, or the function is about to be cut off. It is passed to every provider
   * call. When it fires the loop ends at once with the outcome `aborted`.
   */
  readonly signal?: AbortSignal;
  /**
   * The time limit for the whole message, set by the endpoint below its `maxDuration` (this file chooses no
   * number). When it fires the model call in flight is cancelled; with useful tool results the loop makes the
   * answer-only round, without any it ends with the fallback. The answer-only round is stopped by `signal` only.
   */
  readonly timeLimit?: AbortSignal;
}

export interface AgentUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens: number;
}

export type AgentEvent =
  /** Tools are about to run. `tools` names the known tools asked for, for the status and the usage row. */
  | {
      readonly type: "status";
      readonly messageKey: typeof AGENT_MESSAGE_KEYS.searching;
      readonly tools: readonly string[];
    }
  /** A piece of the answer. Only the round that ends the turn is ever passed on. */
  | { readonly type: "text_delta"; readonly text: string }
  /** The last event, always exactly one. What the usage row, the output check and the cards need. */
  | {
      readonly type: "done";
      readonly outcome: AgentOutcome;
      /** The fixed wording to show with the answer or instead of it; `null` when there is none. */
      readonly noticeKey:
        typeof AGENT_MESSAGE_KEYS.capNote | typeof AGENT_MESSAGE_KEYS.fallback | null;
      /** Why the answer-only round ran, when it did (even if it then failed). */
      readonly limit: AgentLimit | null;
      readonly fallbackReason: AgentFallbackReason | null;
      /** The model ran out of output tokens in the middle of the answer. */
      readonly truncated: boolean;
      /** Model rounds used. A retry after a transient failure is not a round (see `retried`). */
      readonly rounds: number;
      readonly retried: boolean;
      /** Tool calls that were run in each round with tools, refused calls not counted. */
      readonly toolCallsPerRound: readonly number[];
      /** The names of the tools that ran, each once, in the order they first ran. */
      readonly toolsRan: readonly string[];
      /** Summed over every provider call, failed ones and the retry included. */
      readonly usage: AgentUsage;
      /** Every home a tool returned during this message, each once: the only ids a card or link may use. */
      readonly references: readonly ToolReference[];
      /**
       * The text of every tool result that came back with data this message, exactly as the model received it (JSON).
       * The output check takes contacts and figures from these and from nothing else (P4-T02), so the endpoint
       * passes them on as its `toolResults`. Error results carry no facts and are left out.
       */
      readonly toolResults: readonly string[];
    };

export type AgentDone = Extract<AgentEvent, { type: "done" }>;
