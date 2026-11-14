import "server-only";
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from "openai";
import type {
  ResponseCreateParamsStreaming,
  ResponseInputItem,
  ResponseStreamEvent,
  Tool,
} from "openai/resources/responses/responses";
import { AI_PROVIDER_IDLE_TIMEOUT_MS, MAX_OUTPUT_TOKENS } from "@/config/ai";
import { aiFailureFromHttpStatus, aiFailureFromThrown, describeAiFailure } from "./errors";
import type {
  AiCall,
  AiEvent,
  AiFailure,
  AiMessage,
  AiProvider,
  AiToolDefinition,
  AiUsage,
} from "./types";

/**
 * The OpenAI adapter (ADR-128 section 4.4), behind the neutral interface in `types.ts`. It speaks the
 * Responses API over the official `openai` package and turns each round into our own events, so nothing
 * above it knows OpenAI's field names, event names or error text.
 *
 * What it guarantees, rule by rule of section 4.4:
 * - Rule 2: tool arguments are parsed here (`undefined` when the text is not JSON); the loop validates them.
 * - Rule 3: one tool call per round is requested (`parallel_tool_calls: false`). If the model returns several
 *   anyway, every one is delivered, in order, never dropped. Parallel calls are switched on only after the
 *   conformance run against the real API passes the parallel cases (the owner's manual run).
 * - Rule 4: stateless. `store: false`, no stored responses and no conversation id; the whole conversation is
 *   sent on every call.
 * - Rule 5: no provider-hosted tools; only our function tools.
 * - Rule 6: the model id and key are given by the caller (from `src/server/env.ts`); no model name is written here.
 * - Errors: every failure ends the stream with `stop: error` and one of our own failures; no provider message
 *   is kept, logged or passed on. The key is never copied into an event.
 */

/** OpenAI refuses `max_output_tokens` below this (API limit, checked against the Responses reference). */
const MINIMUM_OUTPUT_TOKENS = 16;

/** Error codes OpenAI gives for a request its safety layer declined before answering. */
const REFUSED_CODES: ReadonlySet<string> = new Set([
  "content_policy_violation",
  "content_filter",
  "invalid_prompt",
]);

export interface OpenAiProviderOptions {
  readonly apiKey: string;
  /** The model id from configuration (`AI_MODEL`). */
  readonly model: string;
  /** The HTTP function. Tests pass a mock so no network is used; production uses the platform `fetch`. */
  readonly fetch?: typeof fetch;
  /** Only for tests and the data-residency host. Defaults to OpenAI's own address. */
  readonly baseURL?: string;
  /** Overrides `AI_PROVIDER_IDLE_TIMEOUT_MS`. */
  readonly idleTimeoutMs?: number;
}

// ---------------------------------------------------------------- the request

function toolsForOpenAi(tools: readonly AiToolDefinition[]): Tool[] {
  return tools.map((tool): Tool => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: { ...tool.parameters },
    // Strict mode wants the portable subset (every field required, no extra fields), which is what
    // `toPortableJsonSchema` produces.
    strict: true,
  }));
}

function inputForOpenAi(messages: readonly AiMessage[]): ResponseInputItem[] {
  const items: ResponseInputItem[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      items.push({ role: "user", content: message.text });
    } else if (message.role === "assistant") {
      if (message.text !== "") items.push({ role: "assistant", content: message.text });
      for (const toolCall of message.toolCalls) {
        items.push({
          type: "function_call",
          call_id: toolCall.id,
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.input),
        });
      }
    } else {
      items.push({
        type: "function_call_output",
        call_id: message.callId,
        output: message.content,
      });
    }
  }
  return items;
}

export function buildOpenAiRequest(call: AiCall, model: string): ResponseCreateParamsStreaming {
  const request: ResponseCreateParamsStreaming = {
    model,
    instructions: call.system,
    input: inputForOpenAi(call.messages),
    stream: true,
    store: false,
    max_output_tokens: Math.max(
      MINIMUM_OUTPUT_TOKENS,
      Math.min(call.maxOutputTokens, MAX_OUTPUT_TOKENS),
    ),
  };
  // An answer-only round has no tools; the API is then sent neither a tool list nor a tool setting.
  if (call.tools.length === 0) return request;
  return {
    ...request,
    tools: toolsForOpenAi(call.tools),
    tool_choice: "auto",
    parallel_tool_calls: false,
  };
}

// ---------------------------------------------------------------- failures

/** The failure for an error code OpenAI puts in a stream event or a response, never for its message text. */
function failureFromCode(code: string | null | undefined): AiFailure {
  if (code === undefined || code === null) return describeAiFailure("rejected");
  if (REFUSED_CODES.has(code)) return describeAiFailure("refused");
  if (code === "rate_limit_exceeded") return describeAiFailure("rate_limited");
  // Our account has no credit left: retrying cannot help and the fault is ours, not the customer's.
  if (code === "insufficient_quota") return describeAiFailure("rejected");
  if (code === "server_error" || code === "overloaded" || code === "service_unavailable") {
    return describeAiFailure("unavailable");
  }
  return describeAiFailure("rejected");
}

interface FailureContext {
  /** Our own clock ran out, or the caller's signal fired. */
  readonly cancelled: boolean;
  /** At least one event had arrived, so the stream was cut rather than never started. */
  readonly started: boolean;
}

function failureFromThrown(error: unknown, context: FailureContext): AiFailure {
  if (context.cancelled) return describeAiFailure("timeout");
  if (error instanceof APIConnectionTimeoutError || error instanceof APIUserAbortError) {
    return describeAiFailure("timeout");
  }
  if (error instanceof APIConnectionError) {
    return describeAiFailure(context.started ? "interrupted" : "unavailable");
  }
  if (error instanceof APIError) {
    if (error.status === undefined) {
      // An error event inside the stream (no HTTP status of its own).
      return failureFromCode(error.code);
    }
    if (error.status === 400 && error.code !== null && error.code !== undefined) {
      if (REFUSED_CODES.has(error.code)) return describeAiFailure("refused");
    }
    if (error.status === 429 && error.code === "insufficient_quota") {
      return describeAiFailure("rejected");
    }
    return aiFailureFromHttpStatus(error.status);
  }
  // A body that stopped or sent text that is not valid event JSON, after the stream began.
  if (context.started) return describeAiFailure("interrupted");
  return aiFailureFromThrown(error);
}

// ---------------------------------------------------------------- the stream

interface PendingToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}

interface RoundState {
  started: boolean;
  finished: boolean;
  refused: boolean;
  readonly toolCalls: PendingToolCall[];
}

/** The arguments as the model wrote them: an object when the text is JSON, `undefined` when it is not. */
function parseArguments(text: string): unknown {
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function usageEvent(usage: {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number } | null;
}): AiEvent {
  const result: AiUsage = {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    ...(typeof usage.input_tokens_details?.cached_tokens === "number"
      ? { cachedInputTokens: usage.input_tokens_details.cached_tokens }
      : {}),
  };
  return { type: "usage", ...result };
}

function errorStop(failure: AiFailure): AiEvent {
  return { type: "stop", reason: "error", failure };
}

/** Turns one provider event into zero or more of ours, and notes on `state` how the round is going. */
function translate(event: ResponseStreamEvent, state: RoundState): AiEvent[] {
  switch (event.type) {
    case "response.output_text.delta":
      return event.delta === "" ? [] : [{ type: "text_delta", text: event.delta }];

    case "response.refusal.delta":
      // The refusal text is the provider's own words; it never reaches the customer (the loop says it in fixed words).
      state.refused = true;
      return [];

    case "response.output_item.done":
      if (event.item.type === "function_call") {
        state.toolCalls.push({
          id: event.item.call_id,
          name: event.item.name,
          input: parseArguments(event.item.arguments),
        });
      }
      return [];

    case "response.completed": {
      state.finished = true;
      const events: AiEvent[] = state.toolCalls.map((toolCall): AiEvent => ({
        type: "tool_call",
        ...toolCall,
      }));
      if (event.response.usage) events.push(usageEvent(event.response.usage));
      if (state.toolCalls.length > 0) events.push({ type: "stop", reason: "tool_use" });
      else if (state.refused) events.push({ type: "stop", reason: "refusal" });
      else events.push({ type: "stop", reason: "end" });
      return events;
    }

    case "response.incomplete": {
      state.finished = true;
      const events: AiEvent[] = [];
      if (event.response.usage) events.push(usageEvent(event.response.usage));
      const reason = event.response.incomplete_details?.reason;
      if (reason === "max_output_tokens") events.push({ type: "stop", reason: "length" });
      else if (reason === "content_filter") events.push({ type: "stop", reason: "refusal" });
      else events.push(errorStop(describeAiFailure("interrupted")));
      return events;
    }

    case "response.failed":
      state.finished = true;
      return [errorStop(failureFromCode(event.response.error?.code))];

    case "error":
      state.finished = true;
      return [errorStop(failureFromCode(event.code))];

    default:
      return [];
  }
}

/**
 * The OpenAI provider. `stream` makes one request; it never throws for a provider failure, it ends with
 * `stop: error`. The caller's `signal` cancels the request, and so does silence longer than the idle timeout.
 */
export function createOpenAiProvider(options: OpenAiProviderOptions): AiProvider {
  const idleTimeoutMs = options.idleTimeoutMs ?? AI_PROVIDER_IDLE_TIMEOUT_MS;
  const client = new OpenAI({
    apiKey: options.apiKey,
    ...(options.baseURL === undefined ? {} : { baseURL: options.baseURL }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    // The agent loop owns the one retry (section 4.5), and a hidden retry would double a customer's wait.
    maxRetries: 0,
    timeout: idleTimeoutMs,
  });

  return {
    name: "openai",
    async *stream(call) {
      if (call.signal?.aborted) {
        yield errorStop(describeAiFailure("timeout"));
        return;
      }

      const controller = new AbortController();
      const state: RoundState = { started: false, finished: false, refused: false, toolCalls: [] };
      let cancelled = false;
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      const cancel = () => {
        cancelled = true;
        controller.abort();
      };
      const restartIdleTimer = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(cancel, idleTimeoutMs);
      };
      call.signal?.addEventListener("abort", cancel, { once: true });

      try {
        restartIdleTimer();
        const events = await client.responses.create(buildOpenAiRequest(call, options.model), {
          signal: controller.signal,
        });
        for await (const event of events) {
          restartIdleTimer();
          state.started = true;
          for (const translated of translate(event, state)) yield translated;
          if (state.finished) return;
        }
        // The body ended with no closing event: our clock or the caller's deadline stopped it, or it was cut off.
        yield errorStop(describeAiFailure(cancelled ? "timeout" : "interrupted"));
      } catch (error) {
        yield errorStop(failureFromThrown(error, { cancelled, started: state.started }));
      } finally {
        clearTimeout(idleTimer);
        call.signal?.removeEventListener("abort", cancel);
        // Stops the request if the consumer left early or an error ended the round.
        controller.abort();
      }
    },
  };
}
