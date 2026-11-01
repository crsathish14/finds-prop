import type { ActionFailure, ErrorCode, FailureReason, FieldError } from "@/types/action";

/**
 * Error thrown by services and handlers when a known failure occurs. The message is for
 * developers and logs and is never returned to the caller: the screen shows the text for `code`
 * from en.json (ADR-035).
 */
export class ActionError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, FieldError[]>;
  readonly retryAfter?: number;
  readonly reason?: FailureReason;

  constructor(
    code: ErrorCode,
    message: string,
    extra: {
      fieldErrors?: Record<string, FieldError[]>;
      retryAfter?: number;
      reason?: FailureReason;
    } = {},
  ) {
    super(message);
    this.name = "ActionError";
    this.code = code;
    if (extra.fieldErrors) this.fieldErrors = extra.fieldErrors;
    if (extra.retryAfter !== undefined) this.retryAfter = extra.retryAfter;
    if (extra.reason) this.reason = extra.reason;
  }
}

/** Postgres and PostgREST codes mapped to the closed ErrorCode set. This is the only mapper. */
const POSTGRES_CODES: Record<string, ErrorCode> = {
  "23505": "CONFLICT", // unique violation
  "23503": "CONFLICT", // foreign key violation
  "23514": "VALIDATION", // check violation
  "23502": "VALIDATION", // not null violation
  "22P02": "VALIDATION", // invalid text representation
  "42501": "FORBIDDEN", // insufficient privilege (RLS denial)
  PGRST116: "NOT_FOUND", // no rows returned for a single-row request
  PGRST301: "UNAUTHENTICATED", // JWT problem
};

function codeOf(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const value = (error as { code?: unknown }).code;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

export function classifyError(error: unknown): ErrorCode {
  if (error instanceof ActionError) return error.code;
  const code = codeOf(error);
  if (code !== undefined) {
    const mapped = POSTGRES_CODES[code];
    if (mapped) return mapped;
  }
  return "INTERNAL";
}

/** Turn anything thrown into a safe failure. Details are logged by the caller, never returned. */
export function toFailure(error: unknown, requestId?: string): ActionFailure {
  const code = classifyError(error);
  const failure: ActionFailure = { ok: false, code };
  if (error instanceof ActionError) {
    if (error.fieldErrors) failure.fieldErrors = error.fieldErrors;
    if (error.retryAfter !== undefined) failure.retryAfter = error.retryAfter;
    if (error.reason) failure.reason = error.reason;
  }
  if (code === "INTERNAL" && requestId) failure.requestId = requestId;
  return failure;
}
