import { describe, expect, it } from "vitest";
import {
  createDefineAction,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { createLogger } from "@/server/logger";
import { sendEnquiryConfig } from "../action-config";
import { submitEnquiry, type EnquiryRow, type EnquiryWriteStore } from "../enquiry-service";

const KEY = "00000000-0000-4000-8000-000000000001";

const CUSTOMER: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const NO_PHONE: SessionView = { ...CUSTOMER, phoneVerified: false };

const enquiry = (overrides: Record<string, unknown> = {}) => ({
  shortId: "k3x9a2bd",
  name: "Priya Raman",
  phone: "98400 12345",
  idempotencyKey: KEY,
  ...overrides,
});

function harness(
  options: { session?: SessionView | null; rateLimited?: boolean; replay?: unknown } = {},
) {
  const calls: string[] = [];
  const stored: EnquiryRow[] = [];
  const session = options.session === undefined ? CUSTOMER : options.session;
  const store: EnquiryWriteStore = {
    insertEnquiry: (row) => {
      calls.push("insert");
      stored.push(row);
      return Promise.resolve("enquiry-1");
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
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 3600 }))
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
  const send = createDefineAction(deps)({
    ...sendEnquiryConfig,
    handler: async ({ input, session: caller }) => {
      await submitEnquiry(store, { input, userId: caller?.userId ?? "" });
      return { received: true as const };
    },
  });
  return { send, calls, stored };
}

describe("UT-send-enquiry: who may send an enquiry (S5-T03, BR-50)", () => {
  it("is refused for a visitor who is not signed in, and stores nothing", async () => {
    const { send, calls } = harness({ session: null });
    expect(await send(enquiry())).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(calls).not.toContain("insert");
  });

  it("is refused for a signed-in user whose phone is not verified, saying why", async () => {
    const { send, calls } = harness({ session: NO_PHONE });
    expect(await send(enquiry())).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      reason: "PHONE_NOT_VERIFIED",
    });
    expect(calls).not.toContain("insert");
  });

  it("stores the enquiry for the signed-in account and says only that it was received", async () => {
    const { send, stored } = harness();
    expect(
      await send(enquiry({ email: "Priya@Example.com", message: " Is it available? " })),
    ).toEqual({
      ok: true,
      data: { received: true },
    });
    expect(stored).toEqual([
      {
        shortId: "k3x9a2bd",
        userId: "user-1",
        name: "Priya Raman",
        phone: "9840012345",
        email: "priya@example.com",
        message: "Is it available?",
      },
    ]);
  });

  it("cannot be sent for another user: a user id in the request is ignored", async () => {
    const { send, stored } = harness();
    await send(enquiry({ userId: "someone-else", user_id: "someone-else" }));
    expect(stored[0]?.userId).toBe("user-1");
  });

  it("checks the input first, so a bad request costs no rate-limit count and no database call", async () => {
    const { send, calls } = harness();
    expect(await send(enquiry({ name: "P" }))).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { name: [{ key: "validation.nameTooShort" }] },
    });
    expect(calls).toEqual([]);
  });

  it("runs the steps in order: authenticate, rate limit (enquiry, per user), idempotency, then the write", async () => {
    const { send, calls } = harness();
    await send(enquiry());
    expect(calls).toEqual([
      "authenticate",
      "rateLimit:enquiry:no-key",
      `begin:sendEnquiry:${KEY}`,
      "insert",
      "complete",
    ]);
  });

  it("says to wait, with the seconds, when the user has sent too many, and stores nothing", async () => {
    const { send, calls } = harness({ rateLimited: true });
    expect(await send(enquiry())).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 3600,
    });
    expect(calls).not.toContain("insert");
  });

  it("answers a repeat of the same form with the first answer and stores no second enquiry", async () => {
    const first = { ok: true, data: { received: true } };
    const { send, calls } = harness({ replay: first });
    expect(await send(enquiry())).toEqual(first);
    expect(calls).not.toContain("insert");
  });
});
