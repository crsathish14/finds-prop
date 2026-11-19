import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  createCategoryConfig,
  deleteCategoryConfig,
  setCategoryActiveConfig,
  updateCategoryConfig,
} from "../action-config";

const CATEGORY = "00000000-0000-4000-b300-000000000001";

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
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 900 }))
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
    return { categoryId: CATEGORY, module: "blog", slug: "buying-guide" };
  };
  return {
    calls,
    create: define({ ...createCategoryConfig, handler }),
    update: define({ ...updateCategoryConfig, handler }),
    switchOn: define({ ...setCategoryActiveConfig, handler }),
    remove: define({ ...deleteCategoryConfig, handler }),
  };
}

const category = { module: "blog", name: "Buying guide", slug: "buying-guide" } as const;

describe("UT-content-category-actions: who may manage categories, and what it refreshes (ADR-143)", () => {
  it("lets a super admin do each of the four things: the admin_edit limit, the handler, the three modules' cache tags, no audit entry from the app", async () => {
    const { create, update, switchOn, remove, calls } = harness();
    expect((await create(category)).ok).toBe(true);
    expect((await update({ ...category, categoryId: CATEGORY })).ok).toBe(true);
    expect((await switchOn({ categoryId: CATEGORY, active: false })).ok).toBe(true);
    expect((await remove({ categoryId: CATEGORY })).ok).toBe(true);
    const once = ["rateLimit:admin_edit", "handler", "invalidate:blog|faq|careers"];
    expect(calls).toEqual([...once, ...once, ...once, ...once]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on every action", async (_who, session, code) => {
    const { create, update, switchOn, remove, calls } = harness({ session });
    expect(await create(category)).toMatchObject({ ok: false, code });
    expect(await update({ ...category, categoryId: CATEGORY })).toMatchObject({ ok: false, code });
    expect(await switchOn({ categoryId: CATEGORY, active: true })).toMatchObject({
      ok: false,
      code,
    });
    expect(await remove({ categoryId: CATEGORY })).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses a category that is not valid before the handler, naming the box", async () => {
    const { create, calls } = harness();
    const bad = await create({ ...category, slug: "Not A Slug" });
    expect(bad).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { slug: [{ key: "validation.categorySlugInvalid" }] },
    });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { create, calls } = harness({ rateLimited: true });
    expect(await create(category)).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 900,
    });
    expect(calls).toEqual(["rateLimit:admin_edit"]);
  });
});
