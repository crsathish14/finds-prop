/**
 * Mapping a provider's failure to our closed `ErrorCode` set (ADR-128 section 4.4, R-BE-05). Every adapter
 * uses these three functions, so OpenAI, Gemini and the fake fail in the same words and no provider message
 * or status text ever travels further than the adapter.
 */
import type { AiErrorKind, AiFailure } from "./types";

/** One row per kind: the code it becomes, and whether the loop may retry once (a transient failure). */
const FAILURES: Record<AiErrorKind, AiFailure> = {
  rate_limited: { kind: "rate_limited", code: "RATE_LIMITED", transient: false },
  timeout: { kind: "timeout", code: "UPSTREAM_FAILED", transient: true },
  unavailable: { kind: "unavailable", code: "UPSTREAM_FAILED", transient: true },
  interrupted: { kind: "interrupted", code: "UPSTREAM_FAILED", transient: true },
  refused: { kind: "refused", code: "UPSTREAM_FAILED", transient: false },
  rejected: { kind: "rejected", code: "INTERNAL", transient: false },
};

export function describeAiFailure(kind: AiErrorKind): AiFailure {
  return FAILURES[kind];
}

/**
 * The kind for an HTTP status from a provider. A content-policy refusal cannot be told from a bad request by
 * its status, so an adapter that can recognise one says `refused` itself.
 */
export function aiFailureFromHttpStatus(status: number): AiFailure {
  if (status === 429) return FAILURES.rate_limited;
  if (status === 408 || status === 504) return FAILURES.timeout;
  if (status >= 500) return FAILURES.unavailable;
  return FAILURES.rejected;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The failure for anything an adapter catches: an aborted or timed-out request, a network error, or an error
 * that carries a numeric `status` (the official SDKs do). Anything else is ours to fix, so it is `rejected`.
 */
export function aiFailureFromThrown(error: unknown): AiFailure {
  if (isRecord(error)) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return FAILURES.timeout;
    if (typeof error.status === "number") return aiFailureFromHttpStatus(error.status);
    // `fetch` rejects with a TypeError when the network fails before any response.
    if (error instanceof TypeError) return FAILURES.unavailable;
  }
  return FAILURES.rejected;
}
