import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefineAction,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { createLogger } from "@/server/logger";
import { submitProjectLeadConfig, trackProjectEventConfig } from "../action-config";
import { recordProjectEvent, submitLead, type ProjectWriteStore } from "../lead-service";

const KEY = "00000000-0000-4000-8000-000000000001";
const VISITOR = "b".repeat(40);

const CUSTOMER: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const NO_PHONE: SessionView = { ...CUSTOMER, phoneVerified: false };

const lead = (overrides: Record<string, unknown> = {}) => ({
  slug: "kadal-vista",
  kind: "enquiry",
  name: "Priya Raman",
  idempotencyKey: KEY,
  ...overrides,
});

function harness(
  options: { session?: SessionView | null; rateLimited?: boolean; replay?: unknown } = {},
) {
  const calls: string[] = [];
  const stored: unknown[] = [];
  const session = options.session === undefined ? CUSTOMER : options.session;
  const store: ProjectWriteStore = {
    insertLead: (row) => {
      calls.push("insert");
      stored.push(row);
      return Promise.resolve("lead-1");
    },
    recordEvent: (row) => {
      calls.push("event");
      stored.push(row);
      return Promise.resolve(true);
    },
  };
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      calls.push("authenticate");
      return Promise.resolve(session);
    },
    rateLimit: ({ scope, key }) => {
      calls.push(`rateLimit:${scope}:${key ?? "no-key"}`);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 1800 }))
        : Promise.resolve();
    },
    beginIdempotent: (request) => {
      calls.push(`begin:${request.scope}:${request.key}`);
      return Promise.resolve(
        options.replay === undefined
          ? { replay: false as const }
          : { replay: true as const, result: options.replay },
      );
    },
    completeIdempotent: () => {
      calls.push("complete");
      return Promise.resolve();
    },
    releaseIdempotent: () => {
      calls.push("release");
      return Promise.resolve();
    },
    invalidate: () => undefined,
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: () => undefined }),
  };
  const define = createDefineAction(deps);
  const submit = define({
    ...submitProjectLeadConfig,
    handler: async ({ input }) => {
      await submitLead(store, { input, phone: "919840012345", visitor: VISITOR });
      return { received: true as const };
    },
  });
  const track = define({
    ...trackProjectEventConfig,
    handler: ({ input }) =>
      recordProjectEvent(store, { slug: input.slug, event: input.event, visitor: VISITOR }),
  });
  return { submit, track, calls, stored };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("UT-submit-project-lead: who may send a lead (S4-T09 step D)", () => {
  it("is refused for a visitor who is not signed in, and stores nothing", async () => {
    const { submit, calls } = harness({ session: null });
    expect(await submit(lead())).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(calls).not.toContain("insert");
  });

  it("is refused for a signed-in user whose phone is not verified, saying why", async () => {
    const { submit, calls } = harness({ session: NO_PHONE });
    expect(await submit(lead())).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      reason: "PHONE_NOT_VERIFIED",
    });
    expect(calls).not.toContain("insert");
  });

  it("stores the lead for a phone-verified user and says only that it was received", async () => {
    const { submit, stored } = harness();
    expect(await submit(lead({ email: "Priya@Example.com" }))).toEqual({
      ok: true,
      data: { received: true },
    });
    expect(stored).toEqual([
      expect.objectContaining({
        slug: "kadal-vista",
        kind: "enquiry",
        name: "Priya Raman",
        email: "priya@example.com",
        phone: "919840012345",
        visitor: VISITOR,
      }),
    ]);
  });

  it("checks the input first, so a bad request costs no rate-limit count and no database call", async () => {
    const { submit, calls } = harness();
    const result = await submit(lead({ name: "P" }));
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { name: [{ key: "validation.nameTooShort" }] },
    });
    expect(calls).toEqual([]);
  });

  it("refuses a site visit with no date, with the field's own message", async () => {
    const { submit } = harness();
    expect(await submit(lead({ kind: "site_visit" }))).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { visitDate: [{ key: "validation.required" }] },
    });
  });

  it("runs the steps in order: authenticate, rate limit (project_lead, per visitor), idempotency, then the write", async () => {
    const { submit, calls } = harness();
    await submit(lead());
    expect(calls).toEqual([
      "authenticate",
      "rateLimit:project_lead:no-key",
      `begin:submitProjectLead:${KEY}`,
      "insert",
      "complete",
    ]);
  });

  it("says to wait a little, with the seconds, when the visitor has sent too many, and stores nothing", async () => {
    const { submit, calls } = harness({ rateLimited: true });
    expect(await submit(lead())).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 1800,
    });
    expect(calls).not.toContain("insert");
  });

  it("answers a repeat of the same form with the first answer and stores no second lead", async () => {
    const first = { ok: true, data: { received: true } };
    const { submit, calls } = harness({ replay: first });
    expect(await submit(lead())).toEqual(first);
    expect(calls).not.toContain("insert");
  });
});

describe("UT-track-project-event: recording that a page was opened", () => {
  it("works for a visitor who is not signed in, with no authentication step", async () => {
    const { track, calls, stored } = harness({ session: null });
    expect(await track({ slug: "kadal-vista", event: "view" })).toEqual({
      ok: true,
      data: { recorded: true },
    });
    expect(calls).toEqual(["rateLimit:project_event:no-key", "event"]);
    expect(stored).toEqual([{ slug: "kadal-vista", event: "view", visitor: VISITOR }]);
  });

  it("is limited to 30 per visitor per minute, and says so with the wait", async () => {
    const { track, calls } = harness({ rateLimited: true });
    expect(await track({ slug: "kadal-vista", event: "view" })).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
    });
    expect(calls).not.toContain("event");
  });

  it("refuses any event but a view for now", async () => {
    const { track, calls } = harness();
    expect(await track({ slug: "kadal-vista", event: "call" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(calls).toEqual([]);
  });
});
