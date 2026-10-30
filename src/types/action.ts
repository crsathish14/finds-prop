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

export interface ActionFailure {
  ok: false;
  code: ErrorCode;
  /** Safe to show to a person. Never a stack trace or a database message. */
  message: string;
  fieldErrors?: Record<string, string[]>;
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
