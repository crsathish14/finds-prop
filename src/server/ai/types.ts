/**
 * The neutral interface to a model provider (ADR-128 section 4.4, R-BE-09). It is shaped by what the agent
 * loop needs, not by any one provider's API, so OpenAI today and Gemini later are each one adapter behind it,
 * and a deterministic fake (`fake.ts`) stands in for tests and CI. Features never call a provider directly.
 *
 * Nothing in here is provider-specific: no provider field names, no provider message text. The stream
 * carries data only, and a failure carries one of our own `ErrorCode`s (the closed set in `@/types/action`),
 * so no provider message can reach a customer.
 */
import type { ErrorCode } from "@/types/action";

/** The providers that can be chosen by name. The fake and OpenAI are wired; Gemini would be one more adapter (ADR-128 section 4.4). */
export const AI_PROVIDER_NAMES = ["fake", "openai"] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

// ---------------------------------------------------------------- tools

/**
 * A tool's input described in the portable JSON Schema subset (rule 1 of section 4.4). It is produced only by
 * `toPortableJsonSchema`, which refuses anything outside the subset, so an adapter can hand it to any provider.
 */
export type AiToolSchema = { readonly [key: string]: unknown };

/** What the provider is told about one tool. The loop keeps the Zod schema; the provider only sees this. */
export interface AiToolDefinition {
  /** Lowercase letters, digits and underscores; both providers accept this shape. */
  readonly name: string;
  readonly description: string;
  readonly parameters: AiToolSchema;
}

/** One tool the model asked for. `input` is an object here: the loop has validated it with the tool's Zod schema. */
export interface AiToolCall {
  /** Pairs the call with its result. Providers differ in how they pair, so we always carry the id. */
  readonly id: string;
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------- messages

/** The conversation we send on every call. We store nothing and the provider keeps nothing (rule 4). */
export type AiMessage =
  | { readonly role: "user"; readonly text: string }
  | {
      readonly role: "assistant";
      readonly text: string;
      /** Zero or more calls; an assistant turn that only answers has none. */
      readonly toolCalls: readonly AiToolCall[];
    }
  | {
      readonly role: "tool";
      /** The `id` of the call this answers. Every call always gets exactly one result. */
      readonly callId: string;
      readonly content: string;
    };

// ---------------------------------------------------------------- the call

/** One request to the provider: one model round. Tools are empty in the answer-only last round. */
export interface AiCall {
  readonly system: string;
  readonly messages: readonly AiMessage[];
  readonly tools: readonly AiToolDefinition[];
  readonly maxOutputTokens: number;
  /** Aborting it cancels the request; the stream then ends with a `timeout` failure. */
  readonly signal?: AbortSignal;
}

// ---------------------------------------------------------------- failures

/**
 * What went wrong, in our words (the adapter maps the provider's error to one of these):
 * - `rate_limited`: the provider says slow down. Not retried at once.
 * - `timeout`: no answer in time, or the caller's deadline passed.
 * - `unavailable`: the provider is down or overloaded.
 * - `interrupted`: the stream was cut off before it finished.
 * - `refused`: the provider declined the request before answering (its own safety layer).
 * - `rejected`: our request or our credentials were refused, or the cause is unknown; the fault is ours.
 */
export const AI_ERROR_KINDS = [
  "rate_limited",
  "timeout",
  "unavailable",
  "interrupted",
  "refused",
  "rejected",
] as const;
export type AiErrorKind = (typeof AI_ERROR_KINDS)[number];

/** A failure as data: the kind, our `ErrorCode`, and whether the loop may try once more (section 4.5). */
export interface AiFailure {
  readonly kind: AiErrorKind;
  readonly code: ErrorCode;
  readonly transient: boolean;
}

// ---------------------------------------------------------------- the stream

/** Tokens used in one round. Cached tokens are given only when the provider reports them. */
export interface AiUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cachedInputTokens?: number;
}

/** Why a round ended. `error` carries the failure; the others carry nothing more. */
export type AiStop =
  | { readonly reason: "end" | "tool_use" | "length" | "refusal" }
  | { readonly reason: "error"; readonly failure: AiFailure };

/**
 * The events of one round, in order. A well-behaved stream ends with exactly one `stop`. A tool call arrives
 * complete: the adapter has assembled and parsed the arguments. `input` is whatever the provider produced
 * (`undefined` when its text was not valid JSON), because the loop validates every call with the tool's Zod
 * schema before running it, whatever the provider promises (rule 2).
 */
export type AiEvent =
  | { readonly type: "text_delta"; readonly text: string }
  | {
      readonly type: "tool_call";
      readonly id: string;
      readonly name: string;
      readonly input: unknown;
    }
  | ({ readonly type: "usage" } & AiUsage)
  | ({ readonly type: "stop" } & AiStop);

/** The one thing a provider must do. The stream does not throw for a provider failure: it ends with `stop` and `error`. */
export interface AiProvider {
  readonly name: AiProviderName;
  stream(call: AiCall): AsyncIterable<AiEvent>;
}
