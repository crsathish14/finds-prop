import { describe, expect, it } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { createLogger } from "@/server/logger";
import { submitFormConfig } from "../action-config";
import { submitFormValues, type FormWriteStore, type SubmissionRow } from "../form-service";

const KEY = "00000000-0000-4000-8000-000000000001";
const VISITOR = "b".repeat(40);

const FORM_ROW = {
  slug: "contact",
  name: "Contact",
  kind: "contact",
  placement: "contact",
  project_id: null,
  button_text: null,
  success_message: null,
  fields: [
    { label: "Your name", key: "name", type: "text", required: true },
    { label: "Mobile", key: "mobile", type: "text", required: true },
  ],
};

const body = (overrides: Record<string, unknown> = {}) => ({
  formSlug: "contact",
  values: { name: "Priya Raman", mobile: "9840012345" },
  idempotencyKey: KEY,
  ...overrides,
});

function harness(options: { rateLimited?: boolean; replay?: unknown } = {}) {
  const calls: string[] = [];
  const stored: SubmissionRow[] = [];
  const store: FormWriteStore = {
    readForm: async () => ({ row: FORM_ROW, found: true }),
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
      return Promise.resolve(null);
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
    ...submitFormConfig,
    handler: async ({ input }) => {
      await submitFormValues(store, { input, visitor: VISITOR });
      return { received: true as const };
    },
  });
  return { send, calls, stored };
}

describe("UT-submit-form: who may send a form (S5-T05, BR-61, BR-70)", () => {
  it("works for a visitor who is not signed in, with no authentication step", async () => {
    const { send, calls, stored } = harness();
    expect(await send(body())).toEqual({ ok: true, data: { received: true } });
    expect(calls).not.toContain("authenticate");
    expect(stored).toHaveLength(1);
  });

  it("runs the steps in order: rate limit (form_submit, per visitor and form), idempotency, then the write", async () => {
    const { send, calls } = harness();
    await send(body());
    expect(calls).toEqual([
      "rateLimit:form_submit:contact",
      `begin:submitForm:${KEY}`,
      "insert",
      "complete",
    ]);
  });

  it("checks the shape first, so a bad request costs no rate-limit count and no database call", async () => {
    const { send, calls } = harness();
    expect(await send(body({ idempotencyKey: "nope" }))).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(calls).toEqual([]);
  });

  it("returns the field errors for wrong answers, stores nothing and gives the claim back", async () => {
    const { send, calls, stored } = harness();
    expect(await send(body({ values: { name: "Priya Raman", mobile: "1" } }))).toMatchObject({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { mobile: [{ key: "validation.phoneInvalid" }] },
    });
    expect(stored).toEqual([]);
    expect(calls).toContain("release");
  });

  it("says to wait, with the seconds, when the visitor has sent too many to this form, and stores nothing", async () => {
    const { send, calls } = harness({ rateLimited: true });
    expect(await send(body())).toMatchObject({ ok: false, code: "RATE_LIMITED", retryAfter: 1800 });
    expect(calls).not.toContain("insert");
  });

  it("answers a repeat of the same form with the first answer and stores no second submission", async () => {
    const first = { ok: true, data: { received: true } };
    const { send, calls } = harness({ replay: first });
    expect(await send(body())).toEqual(first);
    expect(calls).not.toContain("insert");
  });

  it("limits each form on its own: the key is the form's slug", () => {
    expect(submitFormConfig.rateLimit.key({ formSlug: "contact" } as never)).toBe("contact");
    expect(submitFormConfig.rateLimit.key({ formSlug: "vista-visit" } as never)).toBe(
      "vista-visit",
    );
  });
});
