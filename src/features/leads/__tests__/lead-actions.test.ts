import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  loadMoreLeadsConfig,
  loadMoreSubmissionsConfig,
  setLeadStatusConfig,
} from "../action-config";
import type { LeadDone } from "../lead-service";

const PROJECT = "00000000-0000-4000-b000-000000000001";
const LEAD = "00000000-0000-4000-b000-000000000002";

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

const done: LeadDone = { leadId: LEAD, projectId: PROJECT, status: "contacted" };

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
    audit: (event) => {
      calls.push(`audit:${event.action}:${event.entity?.type}:${event.entity?.id}`);
      return Promise.resolve();
    },
    log: createLogger({}, { write: () => undefined }),
  };
  const define = createDefineAction(deps);
  const read = async () => {
    calls.push("handler");
    return { total: 0, nextCursor: null };
  };
  return {
    calls,
    setStatus: define({
      ...setLeadStatusConfig,
      handler: async () => {
        calls.push("handler");
        return done;
      },
    }),
    moreLeads: define({ ...loadMoreLeadsConfig, handler: read }),
    moreSubmissions: define({ ...loadMoreSubmissionsConfig, handler: read }),
  };
}

describe("UT-lead-actions: who may change a lead, and what it records (S7-T07)", () => {
  it("lets a super admin change a lead's state: the admin_edit limit, the handler, an audit entry, no cache refresh", async () => {
    const { setStatus, calls } = harness();
    expect((await setStatus({ leadId: LEAD, status: "contacted" })).ok).toBe(true);
    expect(calls).toEqual([
      "rateLimit:admin_edit",
      "handler",
      `audit:lead.status_changed:lead:${LEAD}`,
    ]);
  });

  it("runs both Show mores with no limit, no refresh and no audit entry: they only read", async () => {
    const { moreLeads, moreSubmissions, calls } = harness();
    expect((await moreLeads({})).ok).toBe(true);
    expect((await moreSubmissions({})).ok).toBe(true);
    expect(calls).toEqual(["handler", "handler"]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on every action", async (_who, session, code) => {
    const { setStatus, moreLeads, moreSubmissions, calls } = harness({ session });
    expect(await setStatus({ leadId: LEAD, status: "closed" })).toMatchObject({ ok: false, code });
    expect(await moreLeads({})).toMatchObject({ ok: false, code });
    expect(await moreSubmissions({})).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses a state that does not exist, and a lead that is not an id, before the handler", async () => {
    const { setStatus, calls } = harness();
    expect(await setStatus({ leadId: LEAD, status: "won" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await setStatus({ leadId: "nope", status: "closed" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { setStatus, calls } = harness({ rateLimited: true });
    expect(await setStatus({ leadId: LEAD, status: "closed" })).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    });
    expect(calls).toEqual(["rateLimit:admin_edit"]);
  });
});
