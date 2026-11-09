import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  addMyUnitConfig,
  addUnitConfig,
  deleteMyUnitConfig,
  deleteUnitConfig,
  loadMoreMyUnitsConfig,
  loadMoreUnitsConfig,
  updateMyUnitConfig,
  updateUnitConfig,
} from "../action-config";
import type { UnitDone } from "../unit-service";

const PROJECT = "00000000-0000-4000-b000-000000000001";
const UNIT = "00000000-0000-4000-b000-000000000002";

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

const done: UnitDone = { unitId: UNIT, projectId: PROJECT, projectSlug: "kadal-vista" };

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
  const handler = async () => {
    calls.push("handler");
    return done;
  };
  return {
    calls,
    add: define({ ...addUnitConfig, handler }),
    update: define({ ...updateUnitConfig, handler }),
    remove: define({ ...deleteUnitConfig, handler }),
    addMine: define({ ...addMyUnitConfig, handler }),
    updateMine: define({ ...updateMyUnitConfig, handler }),
    removeMine: define({ ...deleteMyUnitConfig, handler }),
    moreMine: define({
      ...loadMoreMyUnitsConfig,
      handler: async () => {
        calls.push("handler");
        return { units: [], total: 0, nextCursor: null };
      },
    }),
    more: define({
      ...loadMoreUnitsConfig,
      handler: async () => {
        calls.push("handler");
        return { units: [], total: 0, nextCursor: null };
      },
    }),
  };
}

const newUnit = { projectId: PROJECT, unitNumber: "B-303", status: "available" } as const;
const savedUnit = { unitId: UNIT, unitNumber: "B-303", status: "sold" } as const;

describe("UT-unit-actions: who may manage units, and what it refreshes (S7-T07)", () => {
  it("lets a super admin add a unit: the admin_edit limit, the handler, the project's tags, an audit entry", async () => {
    const { add, calls } = harness();
    expect((await add(newUnit)).ok).toBe(true);
    expect(calls).toEqual([
      "rateLimit:admin_edit",
      "handler",
      "invalidate:projects|project:kadal-vista|home-projects",
      `audit:unit.created:unit:${UNIT}`,
    ]);
  });

  it("does the same for a save and a delete, with their own audit entries", async () => {
    const { update, remove, calls } = harness();
    expect((await update(savedUnit)).ok).toBe(true);
    expect((await remove({ unitId: UNIT })).ok).toBe(true);
    expect(calls.filter((call) => call.startsWith("audit"))).toEqual([
      `audit:unit.updated:unit:${UNIT}`,
      `audit:unit.deleted:unit:${UNIT}`,
    ]);
    expect(calls.filter((call) => call.startsWith("rateLimit"))).toEqual([
      "rateLimit:admin_edit",
      "rateLimit:admin_edit",
    ]);
  });

  it("runs Show more with no limit, no refresh and no audit entry: it only reads", async () => {
    const { more, calls } = harness();
    expect((await more({ projectId: PROJECT })).ok).toBe(true);
    expect(calls).toEqual(["handler"]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on every action", async (_who, session, code) => {
    const { add, update, remove, more, calls } = harness({ session });
    expect(await add(newUnit)).toMatchObject({ ok: false, code });
    expect(await update(savedUnit)).toMatchObject({ ok: false, code });
    expect(await remove({ unitId: UNIT })).toMatchObject({ ok: false, code });
    expect(await more({ projectId: PROJECT })).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses a unit that is not valid, before the handler, naming the box", async () => {
    const { add, calls } = harness();
    const answer = await add({ ...newUnit, unitNumber: "  ", price: "ten" });
    expect(answer).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { add, calls } = harness({ rateLimited: true });
    expect(await add(newUnit)).toMatchObject({ ok: false, code: "RATE_LIMITED", retryAfter: 600 });
    expect(calls).toEqual(["rateLimit:admin_edit"]);
  });
});

describe("UT-builder-unit-actions: the builder's own unit actions (S7-T03)", () => {
  it("lets a builder add a unit: the builder_edit limit, the handler, the project's tags, the same audit entry", async () => {
    const { addMine, calls } = harness({ session: builder });
    expect((await addMine(newUnit)).ok).toBe(true);
    expect(calls).toEqual([
      "rateLimit:builder_edit",
      "handler",
      "invalidate:projects|project:kadal-vista|home-projects",
      `audit:unit.created:unit:${UNIT}`,
    ]);
  });

  it("does the same for a save and a delete, each with the builder_edit limit and its own audit entry", async () => {
    const { updateMine, removeMine, calls } = harness({ session: builder });
    expect((await updateMine(savedUnit)).ok).toBe(true);
    expect((await removeMine({ unitId: UNIT })).ok).toBe(true);
    expect(calls.filter((call) => call.startsWith("audit"))).toEqual([
      `audit:unit.updated:unit:${UNIT}`,
      `audit:unit.deleted:unit:${UNIT}`,
    ]);
    expect(calls.filter((call) => call.startsWith("rateLimit"))).toEqual([
      "rateLimit:builder_edit",
      "rateLimit:builder_edit",
    ]);
  });

  it("runs Show more with no limit, no refresh and no audit entry", async () => {
    const { moreMine, calls } = harness({ session: builder });
    expect((await moreMine({ projectId: PROJECT })).ok).toBe(true);
    expect(calls).toEqual(["handler"]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a super admin", admin, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on every action", async (_who, session, code) => {
    const { addMine, updateMine, removeMine, moreMine, calls } = harness({ session });
    expect(await addMine(newUnit)).toMatchObject({ ok: false, code });
    expect(await updateMine(savedUnit)).toMatchObject({ ok: false, code });
    expect(await removeMine({ unitId: UNIT })).toMatchObject({ ok: false, code });
    expect(await moreMine({ projectId: PROJECT })).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { addMine, calls } = harness({ session: builder, rateLimited: true });
    expect(await addMine(newUnit)).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 600,
    });
    expect(calls).toEqual(["rateLimit:builder_edit"]);
  });
});
