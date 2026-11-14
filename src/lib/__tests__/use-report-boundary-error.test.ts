// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const settings = vi.hoisted(() => ({
  publicEnv: { NEXT_PUBLIC_SENTRY_BROWSER_DSN: undefined as string | undefined },
}));
vi.mock("@/lib/public-env", () => settings);
const reportBrowserError = vi.hoisted(() => vi.fn());
vi.mock("@/lib/browser-error-tracking", () => ({ reportBrowserError }));

import { useReportBoundaryError } from "../use-report-boundary-error";

describe("UT-error-boundary: reporting what the browser caught (ADR-130)", () => {
  beforeEach(() => {
    reportBrowserError.mockClear();
    settings.publicEnv.NEXT_PUBLIC_SENTRY_BROWSER_DSN = undefined;
  });

  it("reports an error thrown in the browser, once an address is set", async () => {
    settings.publicEnv.NEXT_PUBLIC_SENTRY_BROWSER_DSN = "https://key@o1.ingest.de.sentry.io/1";
    const error = new Error("render failed");
    renderHook(() => useReportBoundaryError(error));
    await waitFor(() => expect(reportBrowserError).toHaveBeenCalledWith(error));
  });

  it("does not report an error that came from the server: the server already did, by digest", async () => {
    settings.publicEnv.NEXT_PUBLIC_SENTRY_BROWSER_DSN = "https://key@o1.ingest.de.sentry.io/1";
    renderHook(() => useReportBoundaryError(Object.assign(new Error("x"), { digest: "123" })));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reportBrowserError).not.toHaveBeenCalled();
  });

  it("does nothing, and loads nothing, without an address", async () => {
    renderHook(() => useReportBoundaryError(new Error("x")));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reportBrowserError).not.toHaveBeenCalled();
  });
});
