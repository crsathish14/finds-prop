import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { publicEnv } from "@/lib/public-env";
import { errorTrackingOptions } from "@/lib/error-tracking-options";

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
 * Browser error tracking (ADR-130). Switched on only when `NEXT_PUBLIC_SENTRY_DSN` is set. Only
 * the pieces that catch and describe an error are added: no tracing, no session replay, no
 * feedback widget and no breadcrumbs (clicks, requests and console lines can carry personal data).
 */
if (publicEnv.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: publicEnv.NEXT_PUBLIC_SENTRY_DSN,
    environment: publicEnv.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "unset",
    ...errorTrackingOptions,
    defaultIntegrations: false,
    integrations: [
      Sentry.eventFiltersIntegration(),
      Sentry.functionToStringIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.dedupeIntegration(),
      Sentry.globalHandlersIntegration(),
      Sentry.httpContextIntegration(),
    ],
  });
}
