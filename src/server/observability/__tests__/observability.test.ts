import { beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(async () => true),
}));
vi.mock("@sentry/nextjs", () => sentry);

const settings = vi.hoisted(() => ({
  env: {
    APP_ENV: "dev",
    SENTRY_DSN: undefined as string | undefined,
    VERCEL_GIT_COMMIT_SHA: undefined as string | undefined,
  },
}));
vi.mock("@/server/env", () => settings);

import { errorTrackingOptions } from "@/lib/error-tracking-options";
import { initErrorTracking, reportError, resetErrorTrackingForTests } from "@/server/observability";

const DSN = "https://key@o1.ingest.de.sentry.io/1";

describe("server error tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetErrorTrackingForTests();
    settings.env.SENTRY_DSN = undefined;
    settings.env.VERCEL_GIT_COMMIT_SHA = undefined;
  });

  it("does nothing without a DSN", async () => {
    await initErrorTracking();
    await reportError(new Error("boom"), { source: "action" });
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("starts with errors only, no personal data and the scrubber in place", async () => {
    settings.env.SENTRY_DSN = DSN;
    settings.env.VERCEL_GIT_COMMIT_SHA = "abc123";
    await initErrorTracking();
    expect(sentry.init).toHaveBeenCalledTimes(1);
    const options = sentry.init.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(options).toMatchObject({
      dsn: DSN,
      environment: "dev",
      release: "abc123",
      ...errorTrackingOptions,
    });
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect((options.beforeBreadcrumb as () => unknown)()).toBeNull();
  });

  it("starts only once", async () => {
    settings.env.SENTRY_DSN = DSN;
    await initErrorTracking();
    await initErrorTracking();
    expect(sentry.init).toHaveBeenCalledTimes(1);
  });

  it("reports with tags the team can search by, then waits for the report to leave", async () => {
    settings.env.SENTRY_DSN = DSN;
    await initErrorTracking();
    const error = new Error("boom");
    await reportError(error, {
      source: "action",
      requestId: "req-12345678",
      route: "createEnquiry",
      errorCode: "INTERNAL",
      role: "builder",
    });
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      tags: {
        source: "action",
        request_id: "req-12345678",
        route: "createEnquiry",
        error_code: "INTERNAL",
        role: "builder",
      },
    });
    expect(sentry.flush).toHaveBeenCalledWith(2000);
  });

  it("never throws when the tracker itself fails", async () => {
    settings.env.SENTRY_DSN = DSN;
    await initErrorTracking();
    sentry.captureException.mockImplementationOnce(() => {
      throw new Error("tracker down");
    });
    await expect(reportError(new Error("boom"), { source: "handler" })).resolves.toBeUndefined();
  });
});
