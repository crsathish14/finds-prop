import { scrubEvent } from "@/lib/scrub-event";

/**
 * Settings shared by the browser and the server for the error tracker (ADR-130). The SDK's own
 * defaults collect cookies, headers, request bodies, query strings and local variables; here
 * every one of them is switched off, and the scrubber in `scrub-event.ts` is the second lock.
 */
export const errorTrackingOptions = {
  sendDefaultPii: false,
  dataCollection: {
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
  },
  maxBreadcrumbs: 0,
  beforeBreadcrumb: () => null,
  beforeSend: scrubEvent,
};
