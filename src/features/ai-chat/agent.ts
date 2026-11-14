import "server-only";
import { MAX_MODEL_ROUNDS, MAX_OUTPUT_TOKENS, MAX_TOOL_CALLS_PER_MESSAGE } from "@/config/ai";
import type { AiCall, AiToolCall } from "@/server/ai";
import { logger } from "@/server/logger";
import { runRoundCalls } from "./agent-calls";
import { ANSWER_ONLY_INSTRUCTION } from "./agent-instructions";
import { streamRound, type UsageTotals } from "./agent-round";
import {
  AGENT_MESSAGE_KEYS,
  type AgentDone,
  type AgentEvent,
  type AgentFallbackReason,
  type AgentInput,
  type AgentLimit,
  type AgentOutcome,
} from "./agent-types";
import { toolDefinitions } from "./tools/run";
import { referenceKey, type ToolReference } from "./tools/types";

/**
 * The agent loop (ADR-128 section 4.5), written by us, no framework. One customer message goes in; a small
 * stream of events comes out (`status`, `text_delta`, then exactly one `done`). It talks to the model only
 * through the provider interface and runs tools only through `runRoundCalls`. Rounds 1 to
 * `MAX_MODEL_ROUNDS - 1` may use tools; the last round, or the round after the call cap or the time limit,
 * is answer-only. Text from a round that ends with a tool call is never passed on. Nothing here logs or
 * records what anyone wrote: only counts, tool names and codes.
 */
export async function* runAgent(input: AgentInput): AsyncGenerator<AgentEvent, void> {
  const { provider, tools, system, context, signal, timeLimit } = input;
  const definitions = toolDefinitions(tools);
  const messages = [...input.messages];
  const usage: UsageTotals = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
  const references = new Map<string, ToolReference>();
  const toolCallsPerRound: number[] = [];
  const toolsRan = new Set<string>();
  let rounds = 0;
  let callsUsed = 0;
  let retried = false;
  let limit: AgentLimit | null = null;
  let usefulResults = false;

  const finish = (
    outcome: AgentOutcome,
    details: { fallbackReason?: AgentFallbackReason; truncated?: boolean } = {},
  ): AgentDone => ({
    type: "done",
    outcome,
    noticeKey:
      outcome === "limit"
        ? AGENT_MESSAGE_KEYS.capNote
        : outcome === "fallback"
          ? AGENT_MESSAGE_KEYS.fallback
          : null,
    limit,
    fallbackReason: details.fallbackReason ?? null,
    truncated: details.truncated ?? false,
    rounds,
    retried,
    toolCallsPerRound,
    toolsRan: [...toolsRan],
    usage,
    references: [...references.values()],
  });

  while (true) {
    if (signal?.aborted) {
      yield finish("aborted");
      return;
    }
    const timeUp = timeLimit?.aborted === true;
    if (timeUp && !usefulResults) {
      logger.warn("ai agent time limit without results", { rounds });
      yield finish("fallback", { fallbackReason: "time_limit" });
      return;
    }
    const capReached = callsUsed >= MAX_TOOL_CALLS_PER_MESSAGE;
    const answerOnly = timeUp || capReached || rounds + 1 >= MAX_MODEL_ROUNDS;
    if (answerOnly && rounds > 0) {
      limit = timeUp ? "time_limit" : capReached ? "tool_cap" : "round_cap";
      logger.info("ai agent limit reached", { rounds, limit });
    }

    rounds += 1;
    const call: AiCall = {
      system: answerOnly ? `${system}\n\n${ANSWER_ONLY_INSTRUCTION}` : system,
      messages: [...messages],
      tools: answerOnly ? [] : definitions,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      // The answer-only round is stopped by the hard signal only, or the time limit could never be answered.
      ...signalFor(answerOnly ? signal : anySignal(signal, timeLimit)),
    };
    let round = await streamRound(provider, call, usage);
    if (
      round.status === "failed" &&
      round.failure.transient &&
      !retried &&
      call.signal?.aborted !== true
    ) {
      retried = true;
      logger.warn("ai agent retrying a round", { rounds, kind: round.failure.kind });
      round = await streamRound(provider, call, usage);
    }

    if (signal?.aborted) {
      yield finish("aborted");

      return;
    }
    if (round.status === "failed" && !answerOnly && timeLimit?.aborted) continue;
    if (round.status !== "ok") {
      const reason = round.status === "refused" ? "refused" : "provider_error";
      logger.warn("ai agent gave up on a round", { rounds, reason });
      yield finish("fallback", { fallbackReason: reason });
      return;
    }

    if (!answerOnly && round.calls.length > 0 && round.reason !== "length") {
      const names = tools.map((tool) => tool.name);
      const asked = new Set(
        round.calls.map((asked) => asked.name).filter((name) => names.includes(name)),
      );
      if (asked.size > 0)
        yield { type: "status", messageKey: AGENT_MESSAGE_KEYS.searching, tools: [...asked] };

      const run = await runRoundCalls({
        tools,
        calls: round.calls,
        context,
        budget: MAX_TOOL_CALLS_PER_MESSAGE - callsUsed,
        signal,
      });
      callsUsed += run.attempted;
      toolCallsPerRound.push(run.attempted);
      for (const name of run.ranNames) toolsRan.add(name);
      messages.push({
        role: "assistant",
        text: round.text,
        toolCalls: round.calls.map((asked): AiToolCall => ({
          ...asked,
          input: asRecord(asked.input),
        })),
      });
      for (const { callId, outcome } of run.results) {
        messages.push({ role: "tool", callId, content: outcome.content });
        if (outcome.status !== "ok") continue;
        usefulResults = true;
        for (const reference of outcome.references)
          references.set(referenceKey(reference), reference);
      }
      continue;
    }

    if (round.text.trim() === "") {
      yield finish("fallback", { fallbackReason: "empty_answer" });

      return;
    }
    for (const text of round.deltas) yield { type: "text_delta", text };
    yield finish(limit === null ? "answered" : "limit", { truncated: round.reason === "length" });
    return;
  }
}

/** The `signal` field of a provider call, left out when there is none (exactOptionalPropertyTypes). */
function signalFor(signal: AbortSignal | undefined): { signal?: AbortSignal } {
  return signal === undefined ? {} : { signal };
}

/** One signal that fires when any of the given ones does, or none when none was given. */
function anySignal(...signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const given = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  return given.length === 0 ? undefined : AbortSignal.any(given);
}

/** What a provider produced for a call's arguments, as the object the message list carries (`{}` when it is not one). */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
