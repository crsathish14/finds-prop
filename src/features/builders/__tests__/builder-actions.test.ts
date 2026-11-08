import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  inviteBuilderConfig,
  resendInvitationConfig,
  setBuilderActiveConfig,
  updateBuilderConfig,
} from "../action-config";

const BUILDER = "00000000-0000-4000-b000-000000000001";

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
    return { builderId: BUILDER, active: true };
  };
  return {
    calls,
    invite: define({ ...inviteBuilderConfig, handler }),
    resend: define({ ...resendInvitationConfig, handler }),
    activate: define({ ...setBuilderActiveConfig, handler }),
    update: define({ ...updateBuilderConfig, handler }),
  };
}

const invitation = {
  name: "Kadal Homes",
  email: "sales@kadalhomes.example",
  kind: "builder",
} as const;
const details = { builderId: BUILDER, name: "Kadal Homes", kind: "builder" } as const;

describe("UT-builder-actions: who may manage builders, and what it refreshes (S7-T05)", () => {
  it("lets a super admin invite, counting the admin_decision limit, and refreshes nothing public", async () => {
    const { invite, calls } = harness();
    expect((await invite(invitation)).ok).toBe(true);
    expect(calls).toEqual(["rateLimit:admin_decision", "handler"]);
  });

  it("lets a super admin resend an invitation, with the limit and no cache refresh", async () => {
    const { resend, calls } = harness();
    expect((await resend({ builderId: BUILDER })).ok).toBe(true);
    expect(calls).toEqual(["rateLimit:admin_decision", "handler"]);
  });

  it("refreshes the projects and the developer showcase when a builder is activated, deactivated or edited", async () => {
    const { activate, update, calls } = harness();
    expect((await activate({ builderId: BUILDER, active: false })).ok).toBe(true);
    expect((await update(details)).ok).toBe(true);
    expect(calls).toEqual([
      "rateLimit:admin_decision",
      "handler",
      "invalidate:projects|home-projects",
      "rateLimit:admin_decision",
      "handler",
      "invalidate:projects|home-projects",
    ]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on every action", async (_who, session, code) => {
    const { invite, resend, activate, update, calls } = harness({ session });
    expect(await invite(invitation)).toMatchObject({ ok: false, code });
    expect(await resend({ builderId: BUILDER })).toMatchObject({ ok: false, code });
    expect(await activate({ builderId: BUILDER, active: true })).toMatchObject({ ok: false, code });
    expect(await update(details)).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses an invitation that is not valid, before the handler, with the field named", async () => {
    const { invite, calls } = harness();
    const answer = await invite({ ...invitation, email: "not an email" });
    expect(answer).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { invite, calls } = harness({ rateLimited: true });
    expect(await invite(invitation)).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    });
    expect(calls).toEqual(["rateLimit:admin_decision"]);
  });
});
