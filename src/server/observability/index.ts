import "server-only";
import type * as SentryModule from "@sentry/nextjs";
import { errorTrackingOptions } from "@/lib/error-tracking-options";
import { env } from "../env";

/**
 * Server-side error tracking (ADR-130, plan 09 section 6.2). Without `SENTRY_DSN` nothing is
 * loaded and every function here does nothing, so CI, local work and a deployment that has not
 * switched tracking on behave exactly as before.
 *
 * The SDK is loaded on first use, not at import, so a deployment without a DSN pays nothing.
 */
type Sentry = typeof SentryModule;

let sentry: Sentry | null = null;

/** Called once from instrumentation.ts when the server starts. */
export async function initErrorTracking(): Promise<void> {
  if (!env.SENTRY_DSN || sentry) return;
  const loaded = await import("@sentry/nextjs");
  loaded.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    ...(env.VERCEL_GIT_COMMIT_SHA ? { release: env.VERCEL_GIT_COMMIT_SHA } : {}),
    // Errors only: no performance tracing, no replay, and no data the SDK would collect on its own.
    ...errorTrackingOptions,
  });
  sentry = loaded;
}

export type ErrorContext = {
  /** Where the error was caught. */
  source: "action" | "handler" | "boundary" | "request";
  requestId?: string;
  /** Action or handler name, or the route. */
  route?: string;
  errorCode?: string;
  role?: string;
  /** The reference Next.js shows a visitor on the error page. */
  digest?: string;
};

/**
 * Send one unexpected error to the tracker. Never throws and never blocks for long: reporting an
 * error must not become a second error. Known failures (`ActionError`, validation, not found) are
 * not reported; the caller decides what is unexpected.
 */
export async function reportError(error: unknown, context: ErrorContext): Promise<void> {
  if (!sentry) return;
  try {
    sentry.captureException(error, {
      tags: {
        source: context.source,
        ...(context.requestId && { request_id: context.requestId }),
        ...(context.route && { route: context.route }),
        ...(context.errorCode && { error_code: context.errorCode }),
        ...(context.role && { role: context.role }),
        ...(context.digest && { digest: context.digest }),
      },
    });
    // A serverless function can stop right after it answers; wait briefly for the report to leave.
    await sentry.flush(2000);
  } catch {
    // Deliberately silent: the logger already has the line, and this must not throw.
  }
}

/** Test helper: forget the loaded SDK. */
export function resetErrorTrackingForTests(): void {
  sentry = null;
}
