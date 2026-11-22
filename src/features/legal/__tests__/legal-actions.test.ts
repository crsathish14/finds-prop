import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { saveLegalConfig } from "../action-config";

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
    ...saveLegalConfig,
    handler: async () => {
      calls.push("handler");
      return { kind: "privacy" as const, published: false, version: null };
    },
  });
  return { calls, save };
}

const valid = {
  kind: "privacy",
  summary: "A short summary.",
  sections: [{ id: "one", heading: "One", blocks: [{ type: "paragraph", text: "Some text." }] }],
  publish: false,
};

describe("UT-legal-actions: who may edit the legal pages, and what it refreshes (ADR-151)", () => {
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

  it("refuses text that is not valid, without running the handler", async () => {
    const { save, calls } = harness();
    expect(await save({ ...valid, sections: [] })).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(calls).not.toContain("handler");
  });
});
