import { useEffect } from "react";
import { publicEnv } from "@/lib/public-env";

/**
 * Tells the browser error tracker about an error a Next.js error boundary caught (ADR-130).
 *
 * An error that carries a `digest` was thrown on the server, which already reported it with that
 * digest (instrumentation.ts), so it is not sent twice. One without a digest was thrown in the
 * browser, where React hands it to the boundary instead of the global handlers. Without an address
 * for the tracker this does nothing and downloads nothing.
 */
export function useReportBoundaryError(error: Error & { digest?: string }): void {
  useEffect(() => {
    if (!publicEnv.NEXT_PUBLIC_SENTRY_BROWSER_DSN || error.digest) return;
    void import("@/lib/browser-error-tracking").then((tracking) =>
      tracking.reportBrowserError(error),
    );
  }, [error]);
}
