import "server-only";
import type { Translate } from "@/lib/format";
import type { AiMessage, AiProvider } from "@/server/ai";
import { logger } from "@/server/logger";
import { runAgent } from "../agent";
import type { AgentDone } from "../agent-types";
import {
  createOutputGuard,
  OUTPUT_MESSAGE_KEYS,
  type OutputEvent,
  type OutputSummary,
} from "../guards/output";
import { SYSTEM_PROMPT_CANARY } from "../prompts/version";
import type { AnyAiChatTool } from "../tools/types";
import type { ChatOutcome, ChatStreamEvent } from "./events";

/**
 * One customer message, from the agent loop to the events the customer receives (ADR-128 section 4.5 and 6.4.2).
 *
 * The loop gives the model's answer only once its last round is read (text from a round that ends with a tool call is
 * never passed on), so the answer arrives together with, and just before, the loop's `done` event. This holds the
 * pieces until `done` and then gives the output check what it needs and has not had before: the text of this turn's
 * tool results and the records they named (`toolResults`, `references`), the canary and the prompt text. Each
 * sentence is checked before it is sent; a failed check sends one `replace` and nothing after it. A check that
 * throws fails closed with the same fixed fallback, never the unchecked text.
 */

/** The search page the fixed fallback offers, built by code (ADR-128 section 4.5). */
export const FALLBACK_HREF = "/properties";

export interface TurnInput {
  readonly provider: AiProvider;
  readonly tools: readonly AnyAiChatTool[];
  readonly translate: Translate;
  /** The system prompt for this message, given to the loop and to the output check. */
  readonly system: string;
  /** The conversation, ending with the customer's new message (masked as the input check left it). */
  readonly messages: readonly AiMessage[];
  /** The customer's new message as the model sees it: figures the customer wrote may be said back. */
  readonly customerMessage: string;
  /** The hard stop (the customer left or the function is about to be cut off). */
  readonly signal: AbortSignal;
  /** The time limit for the whole message. */
  readonly timeLimit: AbortSignal;
}

/** What the usage step needs after the turn. `agent` is null only if the loop ended without its `done` event. */
export interface TurnSummary {
  readonly outcome: Exclude<ChatOutcome, "rate_limited">;
  readonly agent: AgentDone | null;
  readonly output: OutputSummary | null;
}

function fallbackReplace(translate: Translate): ChatStreamEvent {
  return {
    type: "replace",
    key: OUTPUT_MESSAGE_KEYS.fallback,
    text: translate(OUTPUT_MESSAGE_KEYS.fallback),
    href: FALLBACK_HREF,
  };
}

function toStreamEvent(event: OutputEvent, translate: Translate): ChatStreamEvent {
  switch (event.type) {
    case "text":
      return { type: "text", text: event.text };
    case "card":
      return { type: "card", reference: event.reference };
    case "notice":
      return { type: "notice", key: event.messageKey, text: translate(event.messageKey) };
    case "replace":
      return {
        type: "replace",
        key: event.messageKey,
        text: translate(event.messageKey),
        // The fallback offers the search page; the self-description does not.
        ...(event.messageKey === OUTPUT_MESSAGE_KEYS.fallback ? { href: FALLBACK_HREF } : {}),
      };
  }
}

export async function* runTurn(input: TurnInput): AsyncGenerator<ChatStreamEvent, TurnSummary> {
  const { translate } = input;
  const deltas: string[] = [];
  let agent: AgentDone | null = null;

  for await (const event of runAgent({
    provider: input.provider,
    tools: input.tools,
    system: input.system,
    messages: input.messages,
    context: { translate, locale: "en" },
    signal: input.signal,
    timeLimit: input.timeLimit,
  })) {
    if (event.type === "status") yield { type: "status", text: translate(event.messageKey) };
    else if (event.type === "text_delta") deltas.push(event.text);
    else agent = event;
  }

  if (agent === null) {
    logger.error("ai agent ended without a result");
    yield fallbackReplace(translate);
    return { outcome: "fallback", agent, output: null };
  }
  if (agent.outcome === "aborted") return { outcome: "aborted", agent, output: null };
  if (agent.outcome === "fallback") {
    yield fallbackReplace(translate);
    return { outcome: "fallback", agent, output: null };
  }

  let output: OutputSummary | null = null;
  try {
    const guard = createOutputGuard({
      toolResults: agent.toolResults,
      references: agent.references,
      customerMessage: input.customerMessage,
      canary: SYSTEM_PROMPT_CANARY,
      promptText: input.system,
    });
    let blocked = false;
    const checked: OutputEvent[] = [];
    for (const delta of deltas) {
      checked.push(...guard.push(delta));
      if (checked.some((event) => event.type === "replace")) break;
    }
    if (!checked.some((event) => event.type === "replace")) checked.push(...guard.finish());
    for (const event of checked) {
      yield toStreamEvent(event, translate);
      if (event.type === "replace") {
        blocked = true;
        break;
      }
    }
    output = guard.summary();
    if (blocked) return { outcome: "blocked", agent, output };
  } catch {
    logger.error("ai output check threw");
    yield fallbackReplace(translate);
    return { outcome: "blocked", agent, output };
  }

  if (agent.noticeKey !== null && agent.outcome === "limit") {
    yield { type: "notice", key: agent.noticeKey, text: translate(agent.noticeKey) };
  }
  return { outcome: agent.outcome, agent, output };
}
