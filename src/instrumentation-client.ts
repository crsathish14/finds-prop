import { z } from "zod";
import { publicEnv } from "@/lib/public-env";

/**
 * Runs in the browser before the app starts (Next.js instrumentation-client).
 *
 * Zod 4 probes whether the page may build functions from strings (`new Function("")`) so it can
 * compile faster parsers. Our content security policy does not allow that (DEC-37), so the probe
 * is refused: harmless, but the browser reports it as a policy violation on every page that
 * builds a schema. `jitless` skips the probe and uses the plain parsers, which is all a browser
 * form needs. Server code is not affected: this file is part of the browser bundle only.
 */
z.config({ jitless: true });

/**
 * Browser error tracking (ADR-130). Switched on only when `NEXT_PUBLIC_SENTRY_BROWSER_DSN` is set.
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
