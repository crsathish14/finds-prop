import type { Instrumentation } from "next";
import { initErrorTracking, reportError } from "@/server/observability";

/**
 * Runs once when a server instance starts (Next.js instrumentation). Error tracking is switched
 * on here when `SENTRY_DSN` is set; otherwise this does nothing. The app has no Edge runtime code:
 * the proxy and every route run on Node.js.
 */
export async function register(): Promise<void> {
  await initErrorTracking();
}

/** Errors Next.js catches itself: a page that fails to render, a route handler that throws. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : undefined;
  await reportError(error, {
    source: "request",
    route: context.routePath,
    ...(digest && { digest }),
  });
};
