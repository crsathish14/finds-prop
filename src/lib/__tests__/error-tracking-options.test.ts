import { describe, expect, it } from "vitest";
import { errorTrackingOptions } from "@/lib/error-tracking-options";
import { scrubEvent } from "@/lib/scrub-event";

describe("UT-redact: error tracker settings", () => {
  it("switches off everything the SDK would collect on its own", () => {
    const { dataCollection } = errorTrackingOptions;
    expect(errorTrackingOptions.sendDefaultPii).toBe(false);
    expect(dataCollection).toMatchObject({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    });
  });

  it("keeps no breadcrumbs and runs the scrubber on every report", () => {
    expect(errorTrackingOptions.maxBreadcrumbs).toBe(0);
    expect(errorTrackingOptions.beforeBreadcrumb()).toBeNull();
    expect(errorTrackingOptions.beforeSend).toBe(scrubEvent);
  });
});
