import { describe, expect, it } from "vitest";
import {
  createDefineAction,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { createLogger } from "@/server/logger";
import { submitProjectFormConfig } from "../action-config";
import {
  submitProjectFormValues,
  type ProjectFormWriteStore,
  type SubmissionRow,
} from "../form-service";
import { submitProjectFormSchema } from "../schemas";

const KEY = "00000000-0000-4000-8000-000000000001";
const VISITOR = "b".repeat(40);
const PHONE = "919840012345";

const CUSTOMER: SessionView = {
  userId: "user-1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

const FORM_ROW = {
  slug: "vista-visit",
  name: "Vista visit",
  kind: "site_visit",
  placement: "project_specific",
  project_id: null,
  button_text: "Book a visit",
  success_message: "See you soon",
  fields: [
    { label: "Your name", key: "name", type: "text", required: true },
    { label: "Mobile", key: "mobile", type: "text", required: true },
    { label: "Preferred day", key: "visit_date", type: "date", required: true },
  ],
};

const body = (overrides: Record<string, unknown> = {}) => ({
  projectSlug: "kadal-vista",
  values: { name: "Priya Raman", visit_date: "2026-12-01" },
  idempotencyKey: KEY,
  ...overrides,
});

function harness(
  options: {
    session?: SessionView | null;
    rateLimited?: boolean;
    replay?: unknown;
    form?: { row: unknown; found: boolean };
  } = {},
) {
  const calls: string[] = [];
  const stored: SubmissionRow[] = [];
  const asked: string[] = [];
  const session = options.session === undefined ? CUSTOMER : options.session;
  const store: ProjectFormWriteStore = {
    readForm: async () => {
      throw new Error("a project's form is never found by a slug from the request");
    },
    readProjectForm: async (slug) => {
      asked.push(slug);
      return options.form ?? { row: FORM_ROW, found: true };
    },
    insertSubmission: (row) => {
      calls.push("insert");
      stored.push(row);
      return Promise.resolve("submission-1");
    },
  };
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => {
      calls.push("authenticate");
      return Promise.resolve(session);
    },
    rateLimit: ({ scope, key }) => {
      calls.push(`rateLimit:${scope}:${key ?? "no-key"}`);
      return options.rateLimited
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 1800 }))
        : Promise.resolve();
    },
    beginIdempotent: (request) => {
      calls.push(`begin:${request.scope}:${request.key}`);
      return Promise.resolve(
        options.replay === undefined
          ? { replay: false as const }
          : { replay: true as const, result: options.replay },
      );
    },
    completeIdempotent: () => {
      calls.push("complete");
      return Promise.resolve();
    },
    releaseIdempotent: () => {
      calls.push("release");
      return Promise.resolve();
    },
    invalidate: () => undefined,
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: () => undefined }),
  };
  const send = createDefineAction(deps)({
    ...submitProjectFormConfig,
    handler: async ({ input }) => {
      await submitProjectFormValues(store, { input, phone: PHONE, visitor: VISITOR });
      return { received: true as const };
    },
  });
  return { send, calls, stored, asked };
}

describe("UT-project-form: a project's assigned form (S5-T05, change 4, BR-49)", () => {
  it("needs a signed-in visitor with a verified phone, and stores nothing for anyone else", async () => {
    const signedOut = harness({ session: null });
    expect(await signedOut.send(body())).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    const noPhone = harness({ session: { ...CUSTOMER, phoneVerified: false } });
    expect(await noPhone.send(body())).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(signedOut.stored).toEqual([]);
    expect(noPhone.stored).toEqual([]);
  });

  it("runs the steps in order: authenticate, rate limit (form_submit, per project), idempotency, write", async () => {
    const { send, calls } = harness();
    expect(await send(body())).toEqual({ ok: true, data: { received: true } });
    expect(calls).toEqual([
      "authenticate",
      "rateLimit:form_submit:project-kadal-vista",
      `begin:submitProjectForm:${KEY}`,
      "insert",
      "complete",
    ]);
  });

  it("finds the form by the project, never by a form named in the request", async () => {
    const { send, stored, asked } = harness();
    await send(body({ formSlug: "some-other-form" }));
    expect(asked).toEqual(["kadal-vista"]);
    expect(stored[0]?.formSlug).toBe("vista-visit");
  });

  it("stores the account's phone, not the one in the request, and the project's own address as the source", async () => {
    const { send, stored } = harness();
    await send(
      body({ values: { name: "Priya Raman", mobile: "9000000000", visit_date: "2026-12-01" } }),
    );
    expect(stored[0]).toMatchObject({
      formSlug: "vista-visit",
      visitor: VISITOR,
      projectSlug: "kadal-vista",
      source: "/projects/kadal-vista",
      idempotencyKey: KEY,
      submission: {
        name: "Priya Raman",
        mobile: PHONE,
        data: { visit_date: "2026-12-01" },
      },
    });
  });

  it("fills the required mobile from the account, so the visitor is never asked for it", async () => {
    const { send, stored } = harness();
    expect((await send(body())).ok).toBe(true);
    expect(stored[0]?.submission.mobile).toBe(PHONE);
  });

  it("stores the account's phone even when the form has no mobile field", async () => {
    const withoutMobile = {
      ...FORM_ROW,
      fields: FORM_ROW.fields.filter((field) => field.key !== "mobile"),
    };
    const { send, stored } = harness({ form: { row: withoutMobile, found: true } });
    expect((await send(body())).ok).toBe(true);
    expect(stored[0]?.submission.mobile).toBe(PHONE);
  });

  it("returns the field errors for wrong answers, stores nothing and gives the claim back", async () => {
    const { send, calls, stored } = harness();
    expect(await send(body({ values: { name: "Priya Raman", visit_date: "soon" } }))).toMatchObject(
      {
        ok: false,
        code: "VALIDATION",
        fieldErrors: { visit_date: [{ key: "validation.invalid" }] },
      },
    );
    expect(stored).toEqual([]);
    expect(calls).toContain("release");
  });

  it("says not found when the project shows no form, and stores nothing", async () => {
    const { send, stored } = harness({ form: { row: null, found: false } });
    expect(await send(body())).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(stored).toEqual([]);
  });

  it("is an internal error when the stored fields do not fit, and stores nothing", async () => {
    const { send, stored } = harness({
      form: {
        row: { ...FORM_ROW, fields: [{ label: "", key: "Bad Key", type: "magic" }] },
        found: true,
      },
    });
    expect(await send(body())).toMatchObject({ ok: false, code: "INTERNAL" });
    expect(stored).toEqual([]);
  });

  it("says to wait when the visitor has sent too many from this project's page, and stores nothing", async () => {
    const { send, calls } = harness({ rateLimited: true });
    expect(await send(body())).toMatchObject({ ok: false, code: "RATE_LIMITED", retryAfter: 1800 });
    expect(calls).not.toContain("insert");
  });

  it("answers a repeat with the first answer and stores no second submission", async () => {
    const first = { ok: true, data: { received: true } };
    const { send, calls } = harness({ replay: first });
    expect(await send(body())).toEqual(first);
    expect(calls).not.toContain("insert");
  });

  it("checks the shape first: a bad key or project address costs no rate-limit count", async () => {
    const { send, calls } = harness();
    expect(await send(body({ idempotencyKey: "nope" }))).toMatchObject({ code: "VALIDATION" });
    expect(await send(body({ projectSlug: "Not A Slug" }))).toMatchObject({ code: "VALIDATION" });
    expect(calls).toEqual([]);
  });

  it("limits each project's page on its own: the key is the project's slug", () => {
    expect(submitProjectFormConfig.rateLimit.key({ projectSlug: "kadal-vista" } as never)).toBe(
      "project-kadal-vista",
    );
  });
});

describe("submitProjectFormSchema", () => {
  it("takes the project, the answers and the key, and drops anything that names a form or a person", () => {
    const parsed = submitProjectFormSchema.parse({
      ...body(),
      formSlug: "x-form",
      mobile: "9000000000",
      userId: "someone",
    });
    expect(Object.keys(parsed).sort()).toEqual(["idempotencyKey", "projectSlug", "values"]);
  });
});
