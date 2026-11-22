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
import type { ConfirmCard } from "../confirm/confirm-card";
import { SITE_LINKS } from "../site-links";
import { sourceHref } from "../source-links";
import type { ProposalOffer } from "../tools/proposal-offer";
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
  /** Whether the customer is signed in: the tools that list homes and projects refuse otherwise (ADR-171). */
  readonly signedIn: boolean;
  /** The hard stop (the customer left or the function is about to be cut off). */
  readonly signal: AbortSignal;
  /** The time limit for the whole message. */
  readonly timeLimit: AbortSignal;
  /**
   * Builds the confirm card for what a propose tool offered (AI-P6-T02). Absent means no card is ever sent. It must
   * not throw; a null answer means no card.
   */
  readonly confirmCard?: (offer: ProposalOffer) => Promise<ConfirmCard | null>;
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
    case "source":
      return {
        type: "source",
        kind: event.reference.kind,
        title: event.reference.title,
        // A reference reaches here only with an address (the guard checks), so the empty text is never drawn.
        href: sourceHref(event.reference) ?? "",
      };
    case "link":
      return {
        type: "link",
        key: event.key,
        text: translate(SITE_LINKS[event.key].labelKey),
        href: SITE_LINKS[event.key].path,
      };
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

/** The EMI lookup: an answer that used it is about money, not about a listing, so it gets no automatic card. */
const EMI_TOOL_NAME = "calculate_emi";

/**
 * Whether the records the tools returned this turn get a card without a marker. Not when the turn ended with a
 * proposal (the customer sees the confirm card, not a listing card), not when the EMI lookup ran (an EMI answer), and
 * not when no tool returned a record (a refusal, an off-topic decline or an empty search made no lookup, so there is
 * nothing to show). The marker still works in every one of those cases.
 */
export function showsAutomaticCards(agent: AgentDone): boolean {
  return (
    agent.references.some(
      (reference) => reference.kind === "home" || reference.kind === "project",
    ) &&
    agent.offers.length === 0 &&
    !agent.toolsRan.includes(EMI_TOOL_NAME)
  );
}

/**
 * Whether the articles and questions the content tools returned this turn get a source link under the answer (ADR-143
 * section 6.5). Not when the turn ended with a proposal: the customer sees the confirm card, not a source.
 */
export function showsAutomaticSources(agent: AgentDone): boolean {
  return (
    agent.offers.length === 0 &&
    agent.references.some(
      (reference) =>
        reference.kind === "article" || reference.kind === "faq" || reference.kind === "job",
    )
  );
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
    context: { translate, locale: "en", signedIn: input.signedIn },
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
  let blocked = false;
  try {
    const guard = createOutputGuard({
      toolResults: agent.toolResults,
      references: agent.references,
      customerMessage: input.customerMessage,
      canary: SYSTEM_PROMPT_CANARY,
      promptText: input.system,
      automaticCards: showsAutomaticCards(agent),
      automaticSources: showsAutomaticSources(agent),
    });
    const checked: OutputEvent[] = [];
    for (const delta of deltas) {
      checked.push(...guard.push(delta));
      if (checked.some((event) => event.type === "replace")) break;
    }
    if (!checked.some((event) => event.type === "replace")) checked.push(...guard.finish());
    // A model text that is only card markers (or only what the check removed) leaves no words: the customer would
    // see a card with a name and nothing said. That is an empty answer, so it gets the fixed reply instead.
    const hasWords = checked.some((event) => event.type === "text" && event.text.trim() !== "");
    if (
      !blocked &&
      !hasWords &&
      agent.offers.length === 0 &&
      !checked.some((event) => event.type === "replace")
    ) {
      logger.warn("ai answer had no words after the check");
      yield fallbackReplace(translate);
      output = guard.summary();
      return { outcome: "fallback", agent, output };
    }
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
    // Nothing but done may follow a replace, so a second one is not sent.
    if (!blocked) yield fallbackReplace(translate);
    return { outcome: "blocked", agent, output };
  }

  // The confirm card of a propose tool, after the checked answer: the last offer of this message, and only when
  // the answer was let through (a replaced answer sends nothing but `done`).
  const offer = agent.offers.at(-1);
  if (offer !== undefined && input.confirmCard !== undefined) {
    const card = await input.confirmCard(offer);
    if (card !== null) yield { type: "confirm", card };
  }

  if (agent.noticeKey !== null && agent.outcome === "limit") {
    yield { type: "notice", key: agent.noticeKey, text: translate(agent.noticeKey) };
  }
  return { outcome: agent.outcome, agent, output };
}
