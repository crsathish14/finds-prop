import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  createMyProjectConfig,
  createProjectConfig,
  updateMyProjectConfig,
  updateProjectConfig,
} from "../action-config";
import type { ProjectDone } from "../project-service";

const BUILDER = "00000000-0000-4000-b000-000000000001";
const PROJECT = "00000000-0000-4000-a000-000000000001";

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

const done: ProjectDone = {
  projectId: PROJECT,
  slug: "kadal-vista",
  previousSlug: null,
  moderation: "pending",
  previousModeration: null,
};

function harness(
  options: { session?: SessionView | null; rateLimited?: boolean; result?: ProjectDone } = {},
) {
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
    return options.result ?? done;
  };
  return {
    calls,
    create: define({ ...createProjectConfig, handler }),
    update: define({ ...updateProjectConfig, handler }),
    createMine: define({ ...createMyProjectConfig, handler }),
    updateMine: define({ ...updateMyProjectConfig, handler }),
  };
}

const minimal = { name: "Kadal Vista", slug: "kadal-vista", locality: "OMR Navalur" };
const adminNew = { ...minimal, builderId: BUILDER };
const save = { projectId: PROJECT, ...minimal };

describe("UT-project-actions: who may save a project, and what it refreshes (S7-T02)", () => {
  it("lets a super admin add and save a project: the project_save limit, the handler, the project's tags, no audit entry of its own", async () => {
    const { create, update, calls } = harness();
    expect((await create(adminNew)).ok).toBe(true);
    expect((await update(save)).ok).toBe(true);
    expect(calls).toEqual([
      "rateLimit:project_save",
      "handler",
      "invalidate:projects|project:kadal-vista|home-projects",
      "rateLimit:project_save",
      "handler",
      "invalidate:projects|project:kadal-vista|home-projects",
    ]);
  });

  it("lets a builder add and save their own project with the same limit and tags", async () => {
    const { createMine, updateMine, calls } = harness({ session: builder });
    expect((await createMine(minimal)).ok).toBe(true);
    expect((await updateMine(save)).ok).toBe(true);
    expect(calls.filter((call) => call.startsWith("rateLimit"))).toEqual([
      "rateLimit:project_save",
      "rateLimit:project_save",
    ]);
    expect(calls.filter((call) => call.startsWith("invalidate"))).toHaveLength(2);
  });

  it("also refreshes the page of the old address when the address changed", async () => {
    const { update, calls } = harness({
      result: { ...done, slug: "kadal-vista-2", previousSlug: "kadal-vista" },
    });
    await update(save);
    expect(calls).toContain(
      "invalidate:projects|project:kadal-vista-2|home-projects|project:kadal-vista",
    );
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)(
    "refuses %s the admin's actions before anything runs",
    async (_who, session, code) => {
      const { create, update, calls } = harness({ session });
      expect(await create(adminNew)).toMatchObject({ ok: false, code });
      expect(await update(save)).toMatchObject({ ok: false, code });
      expect(calls).toEqual([]);
    },
  );

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["the admin", admin, "FORBIDDEN"],
  ] as const)(
    "refuses %s the builder's actions before anything runs",
    async (_who, session, code) => {
      const { createMine, updateMine, calls } = harness({ session });
      expect(await createMine(minimal)).toMatchObject({ ok: false, code });
      expect(await updateMine(save)).toMatchObject({ ok: false, code });
      expect(calls).toEqual([]);
    },
  );

  it("refuses a project that is not valid, before the handler, naming the box", async () => {
    const { create, calls } = harness();
    expect(await create({ ...adminNew, slug: "Not A Slug" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await create(minimal)).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { create, calls } = harness({ rateLimited: true });
    expect(await create(adminNew)).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    });
    expect(calls).toEqual(["rateLimit:project_save"]);
  });
});
