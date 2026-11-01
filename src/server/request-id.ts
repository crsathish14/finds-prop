/**
 * The request id proxy.ts gives every request (x-request-id). It is passed on to Supabase so the
 * audit log can record which request caused a change (F07, `audit_request_id()`). Only a value of
 * this shape is accepted, from a caller or from our own header.
 */
export const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

export function readRequestId(headers: Pick<Headers, "get">): string | undefined {
  const value = headers.get("x-request-id");
  return value && REQUEST_ID_PATTERN.test(value) ? value : undefined;
}

/** Fetch options for a Supabase client: the header only when there is a valid id. */
export function requestIdHeaders(requestId: string | undefined): Record<string, string> {
  return requestId && REQUEST_ID_PATTERN.test(requestId) ? { "x-request-id": requestId } : {};
}
