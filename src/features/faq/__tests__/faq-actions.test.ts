import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import {
  createFaqConfig,
  publishFaqConfig,
  reorderFaqsConfig,
  restoreFaqConfig,
  trashFaqConfig,
  unpublishFaqConfig,
  updateFaqConfig,
} from "../action-config";

const FAQ = "00000000-0000-4000-a400-000000000001";
const CATEGORY = "00000000-0000-4000-b400-000000000001";

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
    return { faqId: FAQ, categoryId: CATEGORY, status: "draft" as const };
  };
  const reorderHandler = async () => {
    calls.push("handler");
    return { categoryId: CATEGORY, count: 1 };
  };
  return {
    calls,
    create: define({ ...createFaqConfig, handler }),
    update: define({ ...updateFaqConfig, handler }),
    publish: define({ ...publishFaqConfig, handler }),
    unpublish: define({ ...unpublishFaqConfig, handler }),
    trash: define({ ...trashFaqConfig, handler }),
    restore: define({ ...restoreFaqConfig, handler }),
    reorder: define({ ...reorderFaqsConfig, handler: reorderHandler }),
  };
}

const question = {
  categoryId: CATEGORY,
  question: "How do I list my property?",
  answer: "Sign in.",
};

async function callEvery(actions: ReturnType<typeof harness>) {
  return [
    await actions.create(question),
    await actions.update({ ...question, faqId: FAQ }),
    await actions.publish({ faqId: FAQ }),
    await actions.unpublish({ faqId: FAQ }),
    await actions.trash({ faqId: FAQ }),
    await actions.restore({ faqId: FAQ }),
    await actions.reorder({ categoryId: CATEGORY, faqIds: [FAQ] }),
  ];
}

describe("UT-faq-actions: who may manage the FAQ, and what it refreshes (ADR-143)", () => {
  it("lets a super admin do each of the seven things: the admin_edit limit, the handler, the faq cache tag, no audit entry from the app", async () => {
    const actions = harness();
    const results = await callEvery(actions);
    expect(results.every((result) => result.ok)).toBe(true);
    const once = ["rateLimit:admin_edit", "handler", "invalidate:faq"];
    expect(actions.calls).toEqual(Array.from({ length: 7 }, () => once).flat());
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs, on every action", async (_who, session, code) => {
    const actions = harness({ session });
    const results = await callEvery(actions);
    for (const result of results) expect(result).toMatchObject({ ok: false, code });
    expect(actions.calls).toEqual([]);
  });

  it("refuses a question that is not valid before the handler, naming the box", async () => {
    const actions = harness();
    const bad = await actions.create({ ...question, question: "Why" });
    expect(bad).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { question: [{ key: "validation.tooShort", values: { minimum: 5 } }] },
    });
    const noCategory = await actions.create({ ...question, categoryId: "nope" });
    expect(noCategory).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { categoryId: [{ key: "validation.invalid" }] },
    });
    expect(actions.calls).toEqual([]);
  });

  it("does not take the trash time, the status of a trashed question or an author from the caller", async () => {
    const actions = harness();
    const result = await actions.create({
      ...question,
      deleted_at: "2026-01-01",
      authorId: "someone",
    });
    expect(result.ok).toBe(true);
    const none = await actions.trash({ faqId: "nope" });
    expect(none).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("answers a rate limit with the wait, and does not run the handler", async () => {
    const actions = harness({ rateLimited: true });
    expect(await actions.reorder({ categoryId: CATEGORY, faqIds: [FAQ] })).toMatchObject({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 900,
    });
    expect(actions.calls).toEqual(["rateLimit:admin_edit"]);
  });
});
