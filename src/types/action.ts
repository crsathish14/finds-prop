/** The closed set of error codes every action and handler returns (plan 05 section 4.1). */
export const ERROR_CODES = [
  "VALIDATION",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "UPSTREAM_FAILED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** A validation problem on one field: a message key under `validation.*` plus values for it. */
export interface FieldError {
  key: string;
  values?: Record<string, string | number>;
}

/**
 * What an action returns on failure. It carries codes and values, never sentences: the screen
 * looks the words up in en.json (ADR-035), so the server stays language-free.
 */
export interface ActionFailure {
  ok: false;
  code: ErrorCode;
  fieldErrors?: Record<string, FieldError[]>;
  /** Seconds until the caller may try again (RATE_LIMITED). */
  retryAfter?: number;
  /** Shown to the user as a support reference for unexpected errors. */
  requestId?: string;
}

export interface ActionSuccess<T> {
  ok: true;
  data: T;
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;
