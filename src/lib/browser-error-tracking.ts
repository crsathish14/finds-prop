import {
  dedupeIntegration,
  eventFiltersIntegration,
  functionToStringIntegration,
  globalHandlersIntegration,
  httpContextIntegration,
  init,
  linkedErrorsIntegration,
} from "@sentry/browser";
import { errorTrackingOptions } from "@/lib/error-tracking-options";

/**
 * Starts browser error tracking (ADR-130). It is a module of its own, with named imports, so the
 * bundler keeps only these integrations and drops the SDK's tracing, replay and feedback code.
 * instrumentation-client.ts loads it with a dynamic import, and only when an address is set.
 */
export function startBrowserErrorTracking(dsn: string, environment: string): void {
  init({
    dsn,
    environment,
    ...errorTrackingOptions,
    defaultIntegrations: false,
    integrations: [
      eventFiltersIntegration(),
      functionToStringIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      globalHandlersIntegration(),
      httpContextIntegration(),
    ],
  });
}
