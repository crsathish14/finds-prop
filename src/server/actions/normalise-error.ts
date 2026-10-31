import type { ActionFailure, ErrorCode } from "@/types/action";

/** Error thrown by services and handlers when a known, user-safe failure occurs. */
export class ActionError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryAfter?: number;

  constructor(
    code: ErrorCode,
    message: string,
    extra: { fieldErrors?: Record<string, string[]>; retryAfter?: number } = {},
  ) {
    super(message);
    this.name = "ActionError";
    this.code = code;
    if (extra.fieldErrors) this.fieldErrors = extra.fieldErrors;
    if (extra.retryAfter !== undefined) this.retryAfter = extra.retryAfter;
  }
}

const SAFE_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: "Some of the information is not valid.",
  UNAUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "We couldn't find that.",
  CONFLICT: "That conflicts with something that already exists.",
  RATE_LIMITED: "Too many attempts. Please try again shortly.",
  UPSTREAM_FAILED: "A service we rely on isn't responding. Please try again.",
  INTERNAL: "Something went wrong on our side. Please try again.",
};

export function safeMessage(code: ErrorCode): string {
  return SAFE_MESSAGES[code];
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
  const failure: ActionFailure = { ok: false, code, message: safeMessage(code) };
  if (error instanceof ActionError) {
    failure.message = error.message;
    if (error.fieldErrors) failure.fieldErrors = error.fieldErrors;
    if (error.retryAfter !== undefined) failure.retryAfter = error.retryAfter;
  }
  if (code === "INTERNAL" && requestId) failure.requestId = requestId;
  return failure;
}
