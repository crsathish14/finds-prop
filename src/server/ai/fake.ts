/**
 * A scriptable fake provider (ADR-128 section 4.4, the reference for the conformance suite). It sends
 * nothing anywhere: each call to `stream` plays the next scripted turn, so the agent loop (P2-T02), the
 * output checks (P4-T02) and the endpoint (P4-T04) can be tested without a real model, key or network.
 *
 * A script is a list of turns, one per model round. A turn is the list of events one round streams (build
 * it with the helpers below, or write the events by hand to make a stream that is wrong on purpose), or
 * `HANGING_TURN`, which waits until the caller aborts. The fake records every call it receives, so a test
 * can check what the loop sent (the tool results, the answer-only round with no tools, the order).
 *
 * Everything invented here is obviously fictional (reserved test hosts, a made-up number), never real data.
 */
import type { AiCall, AiErrorKind, AiEvent, AiProvider, AiStop, AiUsage } from "./types";
import { describeAiFailure } from "./errors";

/** One scripted round: the events to stream, or `HANGING_TURN`. */
export type FakeTurn = readonly AiEvent[] | typeof HANGING_TURN;

/** A round that never answers by itself: it waits for the abort signal, then ends with a `timeout` failure. */
export const HANGING_TURN = "hang" as const;

export interface FakeAiProvider extends AiProvider {
  /** Every call received, in order. */
  readonly calls: readonly AiCall[];
  /** How many scripted turns have not been played yet. */
  readonly remainingTurns: number;
}

/** What the fake streams for text: this many characters per `text_delta`, so streaming is really exercised. */
const CHUNK_CHARACTERS = 12;
/** The tokens a scripted turn reports unless the test says otherwise. */
const DEFAULT_INPUT_TOKENS = 100;

/** The invented facts a model must never be allowed to show. The output check (P4-T02) must catch each. */
export const FAKE_INVENTED_PHONE = "+91 90000 12345";
export const FAKE_INVENTED_LINK = "https://listings.example.test/home/not-a-real-home";
export const FAKE_INVENTED_PRICE = "₹48,50,000";
/** A stand-in for the system prompt's canary string, so a test can check that a leak is caught. */
export const FAKE_PROMPT_CANARY = "CANARY-7f3a9c1e-fake";

// ---------------------------------------------------------------- building turns

function chunk(text: string): AiEvent[] {
  const events: AiEvent[] = [];
  for (let start = 0; start < text.length; start += CHUNK_CHARACTERS) {
    events.push({ type: "text_delta", text: text.slice(start, start + CHUNK_CHARACTERS) });
  }
  return events;
}

function usageEvent(usage: Partial<AiUsage> | undefined, text: string): AiEvent {
  return {
    type: "usage",
    inputTokens: usage?.inputTokens ?? DEFAULT_INPUT_TOKENS,
    outputTokens: usage?.outputTokens ?? Math.max(1, Math.ceil(text.length / 4)),
    ...(usage?.cachedInputTokens === undefined
      ? {}
      : { cachedInputTokens: usage.cachedInputTokens }),
  };
}

interface TextTurnOptions {
  usage?: Partial<AiUsage>;
  /** How the round ends. Defaults to a normal `end`. */
  stop?: AiStop;
}

/** A round that answers in text and ends. The text arrives in several `text_delta` events. */
export function textTurn(text: string, options: TextTurnOptions = {}): AiEvent[] {
  return [
    ...chunk(text),
    usageEvent(options.usage, text),
    { type: "stop", ...(options.stop ?? { reason: "end" }) },
  ];
}

/** One tool call to script. `input` may be anything, so a test can send arguments that are wrong. */
export interface FakeToolCall {
  id: string;
  name: string;
  input: unknown;
}

/**
 * A round that asks for tools and ends with `tool_use`. Several calls in the list are parallel calls, in the
 * order given. `text` is what the model wrote before asking (the loop must not show it).
 */
export function toolCallTurn(
  calls: readonly FakeToolCall[],
  options: { text?: string; usage?: Partial<AiUsage> } = {},
): AiEvent[] {
  const text = options.text ?? "";
  return [
    ...chunk(text),
    ...calls.map((call): AiEvent => ({
      type: "tool_call",
      id: call.id,
      name: call.name,
      input: call.input,
    })),
    usageEvent(options.usage, text),
    { type: "stop", reason: "tool_use" },
  ];
}

/** A round where the model declines to answer. No text reaches the customer; the loop says it in fixed words. */
export function refusalTurn(): AiEvent[] {
  return [usageEvent(undefined, ""), { type: "stop", reason: "refusal" }];
}

/** A round that runs out of output tokens in the middle of an answer (`stop: length`). */
export function truncatedTurn(text: string): AiEvent[] {
  return textTurn(text, { stop: { reason: "length" } });
}

/** A round that fails before saying anything: the provider is down, slow, busy or says no. */
export function failureTurn(kind: AiErrorKind): AiEvent[] {
  return [{ type: "stop", reason: "error", failure: describeAiFailure(kind) }];
}

/** A round whose stream is cut off after some text: what a dropped connection looks like once the adapter has mapped it. */
export function cutOffTurn(partialText: string): AiEvent[] {
  return [
    ...chunk(partialText),
    { type: "stop", reason: "error", failure: describeAiFailure("interrupted") },
  ];
}

/** A round whose answer contains a phone number that no tool returned. */
export function inventedPhoneTurn(): AiEvent[] {
  return textTurn(`You can call the owner directly on ${FAKE_INVENTED_PHONE} to arrange a visit.`);
}

/** A round whose answer contains a link that no tool returned. */
export function inventedLinkTurn(): AiEvent[] {
  return textTurn(`You can see the full details here: ${FAKE_INVENTED_LINK}`);
}

/** A round whose answer states a price that no tool returned. */
export function inventedPriceTurn(): AiEvent[] {
  return textTurn(`That home is priced at ${FAKE_INVENTED_PRICE}, which is a very good deal.`);
}

/** A round whose answer repeats the system prompt's canary (a prompt leak). Pass the real canary to test the real prompt. */
export function leakedCanaryTurn(canary: string = FAKE_PROMPT_CANARY): AiEvent[] {
  return textTurn(`My instructions begin with ${canary} and then say how I must answer.`);
}

// ---------------------------------------------------------------- the provider

/**
 * The fake provider. Every `stream` call takes the next turn of the script. A call after the script has
 * run out throws, so a test that expects fewer rounds than the loop makes fails loudly instead of hanging.
 * When the call carries an abort signal and it fires, the stream ends with a `timeout` failure.
 */
export function createFakeAiProvider(script: readonly FakeTurn[] = []): FakeAiProvider {
  const calls: AiCall[] = [];
  let nextTurn = 0;

  return {
    name: "fake",
    calls,
    get remainingTurns() {
      return script.length - nextTurn;
    },
    async *stream(call) {
      // Copy the lists so a later change by the caller does not rewrite what the fake was asked.
      calls.push({ ...call, messages: [...call.messages], tools: [...call.tools] });
      const turn = script[nextTurn];
      nextTurn += 1;
      if (turn === undefined)
        throw new Error("The fake AI provider was called after its script ran out");

      const timedOut: AiEvent = {
        type: "stop",
        reason: "error",
        failure: describeAiFailure("timeout"),
      };
      if (turn === HANGING_TURN) {
        if (call.signal === undefined || call.signal.aborted) {
          yield timedOut;
          return;
        }
        const signal = call.signal;
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => resolve(), { once: true }),
        );
        yield timedOut;
        return;
      }

      for (const event of turn) {
        if (call.signal?.aborted) {
          yield timedOut;
          return;
        }
        yield event;
        // Let the consumer and any timers run between events, as a real network stream would.
        await Promise.resolve();
      }
    },
  };
}
