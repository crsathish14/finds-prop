import type { ErrorEvent, Stacktrace } from "@sentry/nextjs";
import { redactText, redactValue } from "@/lib/redact";

/**
 * The last step before an error report leaves the app (ADR-130, plan 09 section 6.1). It runs in
 * the browser and on the server, as `beforeSend` of the error tracker.
 *
 * It is deny-by-default: the report is rebuilt from a short list of fields we want, and every
 * other field the SDK may have added (user, cookies, request headers, request body, breadcrumbs,
 * local variables, source lines) is simply not copied. What is copied passes through the same
 * redaction as the logger. A new SDK field therefore stays out until someone adds it here.
 */

/** Tags we set ourselves. A tag with any other name is dropped. */
const ALLOWED_TAGS = new Set([
  "request_id",
  "digest",
  "route",
  "error_code",
  "role",
  "source",
  "runtime",
  "route_type",
]);

/** Context blocks that describe the machine, not the person. */
const ALLOWED_CONTEXTS = new Set(["runtime", "browser", "os"]);

/** The address without its query string or fragment: those are where tokens and ids travel. */
function stripQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return redactText(cut === -1 ? url : url.slice(0, cut));
}

function scrubStacktrace(stacktrace: Stacktrace): Stacktrace {
  if (!stacktrace.frames) return {};
  return {
    frames: stacktrace.frames.map((frame) => ({
      ...(frame.filename !== undefined && { filename: stripQuery(frame.filename) }),
      ...(frame.abs_path !== undefined && { abs_path: stripQuery(frame.abs_path) }),
      ...(frame.module !== undefined && { module: frame.module }),
      ...(frame.function !== undefined && { function: frame.function }),
      ...(frame.lineno !== undefined && { lineno: frame.lineno }),
      ...(frame.colno !== undefined && { colno: frame.colno }),
      ...(frame.in_app !== undefined && { in_app: frame.in_app }),
    })),
  };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const scrubbed: ErrorEvent = { type: undefined };

  if (event.event_id !== undefined) scrubbed.event_id = event.event_id;
  if (event.timestamp !== undefined) scrubbed.timestamp = event.timestamp;
  if (event.platform !== undefined) scrubbed.platform = event.platform;
  if (event.level !== undefined) scrubbed.level = event.level;
  if (event.environment !== undefined) scrubbed.environment = event.environment;
  if (event.release !== undefined) scrubbed.release = event.release;
  if (event.sdk !== undefined) scrubbed.sdk = event.sdk;
  if (event.fingerprint !== undefined) scrubbed.fingerprint = event.fingerprint;
  if (event.message !== undefined) scrubbed.message = redactText(event.message);
  if (event.transaction !== undefined) scrubbed.transaction = redactText(event.transaction);

  if (event.exception?.values) {
    scrubbed.exception = {
      values: event.exception.values.map((entry) => ({
        ...(entry.type !== undefined && { type: entry.type }),
        ...(entry.value !== undefined && { value: redactText(entry.value) }),
        ...(entry.mechanism !== undefined && { mechanism: entry.mechanism }),
        ...(entry.module !== undefined && { module: entry.module }),
        ...(entry.stacktrace !== undefined && { stacktrace: scrubStacktrace(entry.stacktrace) }),
      })),
    };
  }

  if (event.tags) {
    scrubbed.tags = Object.fromEntries(
      Object.entries(event.tags)
        .filter(([name]) => ALLOWED_TAGS.has(name))
        .map(([name, value]) => [name, redactValue(value, name) as typeof value]),
    );
  }

  if (event.contexts) {
    scrubbed.contexts = Object.fromEntries(
      Object.entries(event.contexts)
        .filter(([name]) => ALLOWED_CONTEXTS.has(name))
        .map(([name, value]) => [name, redactValue(value, name) as typeof value]),
    );
  }

  // Method and path only: no headers, cookies, query string, body or client address.
  if (event.request) {
    scrubbed.request = {
      ...(event.request.url !== undefined && { url: stripQuery(event.request.url) }),
      ...(event.request.method !== undefined && { method: event.request.method }),
    };
  }

  return scrubbed;
}
