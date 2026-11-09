import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { deleteProjectConfig, moderateProjectConfig } from "../action-config";

const PROJECT = "00000000-0000-4000-b000-000000000001";

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
  const handler = async () => {
    calls.push("handler");
    return { projectId: PROJECT, slug: "kadal-vista" };
  };
  return {
    calls,
    decide: define({ ...moderateProjectConfig, handler }),
    remove: define({ ...deleteProjectConfig, handler }),
  };
}

describe("UT-project-moderation-actions: who may decide, and what it refreshes (S7-T04)", () => {
  it.each(["approve", "reject", "publish", "unpublish", "feature", "unfeature"] as const)(
    "lets a super admin %s a project: the admin_decision limit, the handler, the project's tags, no audit entry",
    async (decision) => {
      const { decide, calls } = harness();
      expect((await decide({ projectId: PROJECT, decision })).ok).toBe(true);
      expect(calls).toEqual([
        "rateLimit:admin_decision",
        "handler",
        "invalidate:projects|project:kadal-vista|home-projects",
      ]);
    },
  );

  it("lets a super admin delete a project, with the same limit and the same tags", async () => {
    const { remove, calls } = harness();
    expect((await remove({ projectId: PROJECT })).ok).toBe(true);
    expect(calls).toEqual([
      "rateLimit:admin_decision",
      "handler",
      "invalidate:projects|project:kadal-vista|home-projects",
    ]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on both actions", async (_who, session, code) => {
    const { decide, remove, calls } = harness({ session });
    expect(await decide({ projectId: PROJECT, decision: "approve" })).toMatchObject({
      ok: false,
      code,
    });
    expect(await remove({ projectId: PROJECT })).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses a decision that is not one of the six, and an id that is not an id, before the handler", async () => {
    const { decide, remove, calls } = harness();
    expect(await decide({ projectId: PROJECT, decision: "delete" as never })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await decide({ projectId: "nope", decision: "approve" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await remove({ projectId: "nope" })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { decide, calls } = harness({ rateLimited: true });
    expect(await decide({ projectId: PROJECT, decision: "approve" })).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 1200,
    });
    expect(calls).toEqual(["rateLimit:admin_decision"]);
  });
});
