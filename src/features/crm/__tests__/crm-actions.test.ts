import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  deleteIntegrationConfig,
  retryDeliveryConfig,
  saveIntegrationConfig,
  testIntegrationConfig,
} from "../action-config";

const ID = "00000000-0000-4000-a000-000000000001";
const SAVE = { name: "Sample CRM", baseUrl: "https://api.crm-vendor.com", method: "POST" as const };

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
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 600 }))
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
  const handler = async () => {
    calls.push("handler");
    return { integrationId: ID };
  };
  return {
    calls,
    save: define({ ...saveIntegrationConfig, handler }),
    remove: define({ ...deleteIntegrationConfig, handler }),
    test: define({ ...testIntegrationConfig, handler }),
    retry: define({ ...retryDeliveryConfig, handler }),
  };
}

describe("UT-crm-actions: who may manage the CRM connections, and what it counts (S7-T09)", () => {
  it("lets a super admin save or delete: the admin_edit limit, the handler, no cache tag, no audit entry", async () => {
    const { save, remove, calls } = harness();
    expect((await save(SAVE)).ok).toBe(true);
    expect((await remove({ integrationId: ID })).ok).toBe(true);
    expect(calls).toEqual(["rateLimit:admin_edit", "handler", "rateLimit:admin_edit", "handler"]);
  });

  it("limits a test with the admin's decisions, not their edits: it calls somebody else's server", async () => {
    const { test, calls } = harness();
    expect((await test({ integrationId: ID })).ok).toBe(true);
    expect(calls).toEqual(["rateLimit:admin_decision", "handler"]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)(
    "refuses %s before anything runs, on all three actions",
    async (_who, session, code) => {
      const { save, remove, test, calls } = harness({ session });
      expect(await save(SAVE)).toMatchObject({ ok: false, code });
      expect(await remove({ integrationId: ID })).toMatchObject({ ok: false, code });
      expect(await test({ integrationId: ID })).toMatchObject({ ok: false, code });
      expect(calls).toEqual([]);
    },
  );

  it("refuses an address that is not https on the address box, before the handler", async () => {
    const { save, calls } = harness();
    expect(await save({ ...SAVE, baseUrl: "http://api.crm-vendor.com" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { baseUrl: [{ key: "validation.crmUrlNotAllowed" }] },
    });
    expect(calls).toEqual([]);
  });

  it("refuses ids that are not ids, before the handler", async () => {
    const { remove, test, calls } = harness();
    expect(await remove({ integrationId: "nope" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await test({ integrationId: "nope" })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { save, calls } = harness({ rateLimited: true });
    expect(await save(SAVE)).toMatchObject({ ok: false, code: "RATE_LIMITED", retryAfter: 600 });
    expect(calls).toEqual(["rateLimit:admin_edit"]);
  });

  describe("Retry delivery now", () => {
    const SUBMISSION = "00000000-0000-4000-a000-000000000001";

    it("is limited with the admin's decisions, like a test, and has no cache tag or audit entry", async () => {
      const { retry, calls } = harness();
      expect((await retry({ submissionId: SUBMISSION })).ok).toBe(true);
      expect(calls).toEqual(["rateLimit:admin_decision", "handler"]);
    });

    it.each([
      ["a visitor", null, "UNAUTHENTICATED"],
      ["a customer", customer, "FORBIDDEN"],
      ["a builder", builder, "FORBIDDEN"],
    ] as const)("refuses %s before anything runs", async (_who, session, code) => {
      const { retry, calls } = harness({ session });
      expect(await retry({ submissionId: SUBMISSION })).toMatchObject({ ok: false, code });
      expect(calls).toEqual([]);
    });

    it("refuses an id that is not an id, and answers a rate limit with the wait", async () => {
      const first = harness();
      expect(await first.retry({ submissionId: "nope" })).toMatchObject({
        ok: false,
        code: "VALIDATION",
      });
      expect(first.calls).toEqual([]);
      const limited = harness({ rateLimited: true });
      expect(await limited.retry({ submissionId: SUBMISSION })).toMatchObject({
        ok: false,
        code: "RATE_LIMITED",
        retryAfter: 600,
      });
      expect(limited.calls).toEqual(["rateLimit:admin_decision"]);
    });
  });
});
