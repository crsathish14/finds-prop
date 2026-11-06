import { describe, expect, it } from "vitest";
import {
  mapFormWriteError,
  parseFormRow,
  submitFormValues,
  type FormWriteStore,
  type SubmissionRow,
} from "../form-service";
import { formFieldSchema, formFieldsSchema, submitFormSchema } from "../schemas";

const KEY = "00000000-0000-4000-8000-000000000001";
const VISITOR = "a".repeat(40);

const CONTACT_ROW = {
  slug: "contact",
  name: "Contact",
  kind: "contact",
  placement: "contact",
  project_id: null,
  button_text: "Send message",
  success_message: "Thank you",
  fields: [
    { label: "Your name", key: "name", type: "text", required: true },
    { label: "Mobile", key: "mobile", type: "text", required: true, placeholder: null },
    { label: "Message", key: "message", type: "textarea" },
  ],
};

function store(row: unknown = CONTACT_ROW, found = true) {
  const stored: SubmissionRow[] = [];
  const fake: FormWriteStore = {
    readForm: async () => ({ row, found }),
    insertSubmission: async (submission) => {
      stored.push(submission);
      return "submission-1";
    },
  };
  return { fake, stored };
}

const input = (overrides: Record<string, unknown> = {}) =>
  submitFormSchema.parse({
    formSlug: "contact",
    values: { name: "Priya Raman", mobile: "98400 12345", message: "Hello" },
    source: "/contact",
    idempotencyKey: KEY,
    ...overrides,
  });

describe("submitFormValues: storing a submission (S5-T05, BR-60)", () => {
  it("checks the answers against the form read from the database, then stores them", async () => {
    const { fake, stored } = store();
    expect(await submitFormValues(fake, { input: input(), visitor: VISITOR })).toEqual({
      submissionId: "submission-1",
    });
    expect(stored).toEqual([
      {
        formSlug: "contact",
        visitor: VISITOR,
        submission: {
          name: "Priya Raman",
          mobile: "9840012345",
          email: null,
          data: { message: "Hello" },
        },
        source: "/contact",
        projectSlug: null,
        idempotencyKey: KEY,
      },
    ]);
  });

  it("passes the project page the form was filled in on", async () => {
    const { fake, stored } = store();
    await submitFormValues(fake, {
      input: input({ projectSlug: "kadal-vista" }),
      visitor: VISITOR,
    });
    expect(stored[0]?.projectSlug).toBe("kadal-vista");
  });

  it("is not found for a form the database does not show, and stores nothing", async () => {
    const { fake, stored } = store(null, false);
    await expect(
      submitFormValues(fake, { input: input(), visitor: VISITOR }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(stored).toEqual([]);
  });

  it("returns the field errors with nothing stored when the answers are wrong", async () => {
    const { fake, stored } = store();
    await expect(
      submitFormValues(fake, {
        input: input({ values: { name: "P", mobile: "1" } }),
        visitor: VISITOR,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { mobile: [{ key: "validation.phoneInvalid" }] },
    });
    expect(stored).toEqual([]);
  });

  it("is internal, not the visitor's fault, when the stored fields do not fit their shape", async () => {
    const { fake, stored } = store({
      ...CONTACT_ROW,
      fields: [{ label: "x", key: "Bad Key", type: "text" }],
    });
    await expect(
      submitFormValues(fake, { input: input(), visitor: VISITOR }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
    });
    expect(stored).toEqual([]);
  });
});

describe("mapFormWriteError: what record_form_submission raises", () => {
  it.each([
    [{ code: "P0002", message: "form.not_found" }, "NOT_FOUND"],
    [{ code: "23514", message: "violates check constraint" }, "VALIDATION"],
    [{ code: "22023", message: "form.visitor" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ])("maps %j to %s", (failure, code) => {
    expect(mapFormWriteError(failure).code).toBe(code);
  });
});

describe("the stored field shape", () => {
  it("reads a null as not given, and a missing required as optional", () => {
    expect(
      formFieldSchema.parse({
        label: "Q",
        key: "q",
        type: "dropdown",
        options: null,
        min: null,
        required: null,
      }),
    ).toEqual({
      label: "Q",
      key: "q",
      type: "dropdown",
      placeholder: undefined,
      options: undefined,
      min: undefined,
      max: undefined,
      required: false,
    });
  });

  it("refuses an unknown type, a bad key and more than 30 fields", () => {
    expect(formFieldSchema.safeParse({ label: "Q", key: "q", type: "slider" }).success).toBe(false);
    expect(formFieldSchema.safeParse({ label: "Q", key: "1q", type: "text" }).success).toBe(false);
    const many = Array.from({ length: 31 }, (_unused, index) => ({
      label: "Q",
      key: `q${index}`,
      type: "text",
    }));
    expect(formFieldsSchema.safeParse(many).success).toBe(false);
  });

  it("parseFormRow gives null for something that is not a form", () => {
    expect(parseFormRow(null)).toBeNull();
    expect(parseFormRow({ slug: "x" })).toBeNull();
    expect(parseFormRow(CONTACT_ROW)?.fields).toHaveLength(3);
  });
});

describe("submitFormSchema: what the browser may send", () => {
  it("takes a form, its answers, a page address and a key", () => {
    expect(submitFormSchema.safeParse(input()).success).toBe(true);
  });

  it.each([
    ["a slug with a capital", { formSlug: "Contact" }],
    ["a source that leaves the site", { source: "https://evil.example" }],
    ["a key that is not a uuid", { idempotencyKey: "nope" }],
    [
      "more than 40 answers",
      {
        values: Object.fromEntries(
          Array.from({ length: 41 }, (_unused, index) => [`k${index}`, "x"]),
        ),
      },
    ],
    ["a project slug with a slash", { projectSlug: "a/b" }],
  ])("refuses %s", (_label, overrides) => {
    expect(
      submitFormSchema.safeParse({
        formSlug: "contact",
        values: {},
        idempotencyKey: KEY,
        ...overrides,
      }).success,
    ).toBe(false);
  });
});
