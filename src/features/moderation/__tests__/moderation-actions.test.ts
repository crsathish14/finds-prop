import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { moderateListingConfig } from "../action-config";

const LISTING = "00000000-0000-4000-9000-000000000001";

const admin: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000ad",
  roles: ["customer", "super_admin"],
  phoneVerified: false,
  builderId: null,
};
const customer: SessionView = { ...admin, roles: ["customer"], phoneVerified: true };
const builder: SessionView = {
  ...admin,
  roles: ["customer", "builder"],
  builderId: "00000000-0000-4000-8000-0000000000b1",
};

function harness(options: { session?: SessionView | null; rateLimited?: boolean } = {}) {
  const calls: string[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(options.session === undefined ? admin : options.session),
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 1200 }))
        : Promise.resolve();
    },
    beginIdempotent: () => {
      calls.push("begin");
      return Promise.resolve({ replay: false as const });
    },
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: (tags) => {
      calls.push(`invalidate:${tags.join("|")}`);
    },
    audit: () => {
      calls.push("audit");
      return Promise.resolve();
    },
    log: createLogger({}, { write: () => undefined }),
  };
  const define = createDefineAction(deps);
  const decide = define({
    ...moderateListingConfig,
    handler: async () => {
      calls.push("handler");
      return { listingId: LISTING, shortId: "abcd2345", status: "approved", featured: false };
    },
  });
  return { calls, decide };
}

describe("UT-moderation-action: who may decide, and what it does (S6-T04)", () => {
  it("lets a super admin approve, counts the admin_decision limit and refreshes that home's tags", async () => {
    const { decide, calls } = harness();
    const answer = await decide({ decision: "approve", listingId: LISTING });
    expect(answer.ok).toBe(true);
    expect(calls).toEqual([
      "rateLimit:admin_decision",
      "handler",
      "invalidate:home-listings|property:abcd2345",
    ]);
  });

  it.each(["reject", "feature", "unfeature"] as const)("runs %s the same way", async (decision) => {
    const { decide, calls } = harness();
    const answer = await decide({
      decision,
      listingId: LISTING,
      reason: "Photos are not of the home.",
    });
    expect(answer.ok).toBe(true);
    expect(calls).toContain("handler");
    expect(calls).toContain("invalidate:home-listings|property:abcd2345");
  });

  it("writes no audit entry of its own (the database trigger records the change with the admin as actor)", async () => {
    const { decide, calls } = harness();
    await decide({ decision: "approve", listingId: LISTING });
    expect(calls).not.toContain("audit");
    expect(calls).not.toContain("begin");
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before the limit or the handler run", async (_who, session, code) => {
    const { decide, calls } = harness({ session });
    const answer = await decide({ decision: "approve", listingId: LISTING });
    expect(answer).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses an input that is not a decision, before anything else", async () => {
    const { decide, calls } = harness();
    const answer = await decide({ decision: "delete", listingId: LISTING });
    expect(answer).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(calls).toEqual([]);
  });

  it("asks a rejection for its reason and names the field", async () => {
    const { decide, calls } = harness();
    const answer = await decide({ decision: "reject", listingId: LISTING, reason: "   " });
    expect(answer).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { reason: [{ key: "validation.required" }] },
    });
    expect(calls).toEqual([]);
  });

  it("answers rate limited with when to try again, and never runs the handler", async () => {
    const { decide, calls } = harness({ rateLimited: true });
    const answer = await decide({ decision: "approve", listingId: LISTING });
    expect(answer).toMatchObject({ ok: false, code: "RATE_LIMITED", retryAfter: 1200 });
    expect(calls).toEqual(["rateLimit:admin_decision"]);
  });
});
