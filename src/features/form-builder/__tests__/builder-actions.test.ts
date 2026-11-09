import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  createFormConfig,
  deleteFormConfig,
  duplicateFormConfig,
  setFormActiveConfig,
  updateFormConfig,
} from "../action-config";

const FORM = "00000000-0000-4000-b000-000000000002";

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
    return { formId: FORM, slug: "contact" };
  };
  return {
    calls,
    create: define({ ...createFormConfig, handler }),
    update: define({ ...updateFormConfig, handler }),
    switchOn: define({ ...setFormActiveConfig, handler }),
    copy: define({ ...duplicateFormConfig, handler }),
    remove: define({ ...deleteFormConfig, handler }),
  };
}

const form = {
  name: "Contact",
  slug: "contact",
  kind: "contact",
  placement: "contact",
  fields: [{ label: "Name", key: "name", type: "text" }],
} as const;

describe("UT-form-builder-actions: who may build forms, and what it refreshes (S7-T08)", () => {
  it("lets a super admin do each of the five things: the admin_edit limit, the handler, the forms' cache tag, no audit entry", async () => {
    const { create, update, switchOn, copy, remove, calls } = harness();
    expect((await create(form)).ok).toBe(true);
    expect((await update({ ...form, formId: FORM })).ok).toBe(true);
    expect((await switchOn({ formId: FORM, active: false })).ok).toBe(true);
    expect((await copy({ formId: FORM })).ok).toBe(true);
    expect((await remove({ formId: FORM })).ok).toBe(true);
    const once = ["rateLimit:admin_edit", "handler", "invalidate:forms"];
    expect(calls).toEqual([...once, ...once, ...once, ...once, ...once]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on every action", async (_who, session, code) => {
    const { create, update, switchOn, copy, remove, calls } = harness({ session });
    expect(await create(form)).toMatchObject({ ok: false, code });
    expect(await update({ ...form, formId: FORM })).toMatchObject({ ok: false, code });
    expect(await switchOn({ formId: FORM, active: true })).toMatchObject({ ok: false, code });
    expect(await copy({ formId: FORM })).toMatchObject({ ok: false, code });
    expect(await remove({ formId: FORM })).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses a form that is not valid before the handler, naming the box, and a duplicate key on the second field", async () => {
    const { create, calls } = harness();
    const bad = await create({
      ...form,
      slug: "Not A Slug",
      fields: [
        { label: "A", key: "same", type: "text" },
        { label: "B", key: "same", type: "text" },
      ],
    });
    expect(bad).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: {
        slug: [{ key: "validation.slugInvalid" }],
        "fields.1.key": [{ key: "validation.fieldKeyTaken" }],
      },
    });
    expect(calls).toEqual([]);
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const { create, calls } = harness({ rateLimited: true });
    expect(await create(form)).toMatchObject({ ok: false, code: "RATE_LIMITED", retryAfter: 900 });
    expect(calls).toEqual(["rateLimit:admin_edit"]);
  });
});
