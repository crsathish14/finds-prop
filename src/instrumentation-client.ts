// Must stay first: the next import parses a schema while it loads (see zod-jitless.ts).
import "@/lib/zod-jitless";
import { publicEnv } from "@/lib/public-env";

/**
 * Runs in the browser before the app starts (Next.js instrumentation-client). Two things happen
 * here: zod is told not to build functions from strings (so the content security policy sees no
 * violation; see zod-jitless.ts), and browser error tracking (ADR-130) starts when an address is
 * set.
 *
 * Browser error tracking: Switched on only when `NEXT_PUBLIC_SENTRY_BROWSER_DSN` is set.
 *
 * The plain browser SDK is used, not the Next.js package: the Next.js client entry pulls in
 * tracing, replay and feedback code that tree-shaking cannot remove (about 150 KB compressed in
 * the first build). It is also loaded with a dynamic import, so a deployment without
 * an address downloads none of it, and one with an address fetches it after the page has started.
 * An error thrown in the first moments of a page load is therefore not seen; that is accepted.
 * Only the pieces that catch and describe an error are added: no tracing, no session replay, no
 * feedback widget and no breadcrumbs (clicks, requests and console lines can carry personal data).
 */
if (publicEnv.NEXT_PUBLIC_SENTRY_BROWSER_DSN) {
  const dsn = publicEnv.NEXT_PUBLIC_SENTRY_BROWSER_DSN;
  const environment = publicEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "unset";
  void import("@/lib/browser-error-tracking").then((tracking) =>
    tracking.startBrowserErrorTracking(dsn, environment),
  );
}
