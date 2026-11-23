import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { saveMailTemplateConfig } from "../action-config";

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

function harness(session: SessionView | null = admin) {
  const calls: string[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(session),
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return Promise.resolve();
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
      calls.push(`audit:${event.action}`);
      return Promise.resolve();
    },
    log: createLogger({}, { write: () => undefined }),
  };
  const define = createDefineAction(deps);
  const save = define({
    ...saveMailTemplateConfig,
    handler: async () => {
      calls.push("handler");
      return { kind: "enquiry_poster" as const, published: false };
    },
  });
  return { calls, save };
}

const valid = {
  kind: "enquiry_poster",
  subject: "From {enquirerName}",
  body: "Hello, {enquirerName} wrote.",
  publish: false,
};

describe("UT-mail-template-actions: who may edit the mail wording, and what it refreshes (ADR-183)", () => {
  it("lets a super admin save: the admin_edit limit, the handler, the site content tag, no audit call (the database audits)", async () => {
    const { save, calls } = harness();
    expect((await save(valid)).ok).toBe(true);
    expect(calls).toEqual(["rateLimit:admin_edit", "handler", "invalidate:site-settings"]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["a customer", customer, "FORBIDDEN"],
    ["a builder", builder, "FORBIDDEN"],
  ] as const)("refuses %s before anything runs", async (_who, session, code) => {
    const { save, calls } = harness(session);
    expect(await save(valid)).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses wording that is not valid, with the problem on its box, without running the handler", async () => {
    const { save, calls } = harness();
    const result = await save({ ...valid, body: "Call {phone} {enquirerName}" });
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { body: [{ key: "validation.mailPlaceholderUnknown" }] },
    });
    expect(calls).not.toContain("handler");
  });
});
