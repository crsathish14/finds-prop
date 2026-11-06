import { describe, expect, it } from "vitest";
import { formFieldSchema, type FormField } from "../schemas";
import { DATA_MAX_BYTES, validateSubmission } from "../validate";

/** A field as a stored form gives it, through the same schema the server reads it with. */
function field(overrides: Record<string, unknown>): FormField {
  return formFieldSchema.parse({ label: "A field", key: "a_field", type: "text", ...overrides });
}

function errorsOf(fields: FormField[], values: Record<string, unknown>) {
  const result = validateSubmission(fields, values);
  return result.ok ? null : result.fieldErrors;
}

describe("UT-dynamic-form: answers checked against the stored fields (S5-T05, BR-60)", () => {
  it("fills the submission's own columns from name, mobile and email, and keeps the rest as data", () => {
    const result = validateSubmission(
      [
        field({ key: "name", label: "Your name", required: true }),
        field({ key: "mobile", label: "Mobile", required: true }),
        field({ key: "email", type: "email", label: "Email" }),
        field({ key: "message", type: "textarea", label: "Message" }),
      ],
      {
        name: "  Priya   Raman ",
        mobile: "+91 98400-12345",
        email: " Priya@Example.com ",
        message: "Hello\r\nthere",
      },
    );
    expect(result).toEqual({
      ok: true,
      submission: {
        name: "Priya   Raman",
        mobile: "919840012345",
        email: "priya@example.com",
        data: { message: "Hello\nthere" },
      },
    });
  });

  it("drops an answer for a key the form does not have", () => {
    const result = validateSubmission([field({ key: "message" })], {
      message: "Hi",
      admin: "yes",
      __proto__: "x",
    });
    expect(result.ok && result.submission.data).toEqual({ message: "Hi" });
  });

  it("leaves out an optional field that was left empty, and refuses a required one", () => {
    const fields = [field({ key: "note" }), field({ key: "need", required: true })];
    expect(errorsOf(fields, { note: "   ", need: "" })).toEqual({
      need: [{ key: "validation.required" }],
    });
    const ok = validateSubmission([field({ key: "note" })], { note: "  " });
    expect(ok.ok && ok.submission.data).toEqual({});
  });

  describe("text and textarea", () => {
    it("keeps the length rules of the field, and defaults when it gives none", () => {
      const limited = [field({ key: "text_answer", min: 3, max: 5 })];
      expect(errorsOf(limited, { text_answer: "ab" })).toEqual({
        text_answer: [{ key: "validation.tooShort", values: { minimum: 3 } }],
      });
      expect(errorsOf(limited, { text_answer: "abcdef" })).toEqual({
        text_answer: [{ key: "validation.tooLong", values: { maximum: 5 } }],
      });
      expect(errorsOf(limited, { text_answer: "abcd" })).toBeNull();
      expect(errorsOf([field({ key: "text_answer" })], { text_answer: "x".repeat(201) })).toEqual({
        text_answer: [{ key: "validation.tooLong", values: { maximum: 200 } }],
      });
      expect(
        errorsOf([field({ key: "text_answer", type: "textarea" })], {
          text_answer: "x".repeat(2001),
        }),
      ).toEqual({
        text_answer: [{ key: "validation.tooLong", values: { maximum: 2000 } }],
      });
    });

    it("refuses an answer with a control character, and one that is not text", () => {
      expect(errorsOf([field({ key: "text_answer" })], { text_answer: "a\u0007b" })).toEqual({
        text_answer: [{ key: "validation.invalid" }],
      });
      expect(errorsOf([field({ key: "text_answer" })], { text_answer: ["a"] })).toEqual({
        text_answer: [{ key: "validation.invalid" }],
      });
    });
  });

  describe("number", () => {
    const number = [field({ key: "count_answer", type: "number", min: 1, max: 10 })];

    it("takes a number or a numeric text, inside the limits", () => {
      const result = validateSubmission(number, { count_answer: "7" });
      expect(result.ok && result.submission.data).toEqual({ count_answer: 7 });
      expect(errorsOf(number, { count_answer: 3.5 })).toBeNull();
    });

    it("refuses text, and a value outside the limits", () => {
      expect(errorsOf(number, { count_answer: "seven" })).toEqual({
        count_answer: [{ key: "validation.invalid" }],
      });
      expect(errorsOf(number, { count_answer: 0 })).toEqual({
        count_answer: [{ key: "validation.tooSmall", values: { minimum: 1 } }],
      });
      expect(errorsOf(number, { count_answer: 11 })).toEqual({
        count_answer: [{ key: "validation.tooBig", values: { maximum: 10 } }],
      });
    });
  });

  describe("email and mobile", () => {
    it("lower-cases an email and refuses one that is not", () => {
      const fields = [field({ key: "contact", type: "email" })];
      const ok = validateSubmission(fields, { contact: "A@B.CO" });
      expect(ok.ok && ok.submission.data).toEqual({ contact: "a@b.co" });
      expect(errorsOf(fields, { contact: "nope" })).toEqual({
        contact: [{ key: "validation.emailInvalid" }],
      });
    });

    it("reads a mobile as 6 to 15 digits and refuses anything else", () => {
      const fields = [field({ key: "mobile", label: "Mobile" })];
      expect(errorsOf(fields, { mobile: "12345" })).toEqual({
        mobile: [{ key: "validation.phoneInvalid" }],
      });
      expect(errorsOf(fields, { mobile: "98400abcde" })).toEqual({
        mobile: [{ key: "validation.phoneInvalid" }],
      });
      expect(errorsOf(fields, { mobile: "(044) 2345 6789" })).toBeNull();
    });
  });

  describe("dropdown, radio and checkbox", () => {
    const options = ["A home to buy", "A home to rent"];

    it("takes only one of the field's own options", () => {
      for (const type of ["dropdown", "radio"]) {
        const fields = [field({ key: "interest", type, options })];
        expect(errorsOf(fields, { interest: "A home to buy" })).toBeNull();
        expect(errorsOf(fields, { interest: "Something else" })).toEqual({
          interest: [{ key: "validation.invalid" }],
        });
      }
    });

    it("takes a list of the field's own options for a group of checkboxes", () => {
      const fields = [field({ key: "likes", type: "checkbox", options })];
      const ok = validateSubmission(fields, { likes: ["A home to buy", "A home to rent"] });
      expect(ok.ok && ok.submission.data).toEqual({ likes: options });
      expect(errorsOf(fields, { likes: ["A home to buy", "Nope"] })).toEqual({
        likes: [{ key: "validation.invalid" }],
      });
    });

    it("takes true or false for a single checkbox, and needs it ticked when it is required", () => {
      const optional = [field({ key: "news", type: "checkbox" })];
      const ticked = validateSubmission(optional, { news: true });
      expect(ticked.ok && ticked.submission.data).toEqual({ news: true });
      const required = [field({ key: "agree", type: "checkbox", required: true })];
      expect(errorsOf(required, { agree: false })).toEqual({
        agree: [{ key: "validation.required" }],
      });
      expect(errorsOf(required, { agree: true })).toBeNull();
      expect(errorsOf(optional, { news: "maybe" })).toEqual({
        news: [{ key: "validation.invalid" }],
      });
    });
  });

  describe("date", () => {
    const date = [field({ key: "day", type: "date" })];

    it("takes a real day written YYYY-MM-DD", () => {
      expect(errorsOf(date, { day: "2026-11-20" })).toBeNull();
    });

    it("refuses anything else, including a day that does not exist", () => {
      for (const bad of ["20/11/2026", "2026-13-01", "2026-02-30", "tomorrow"]) {
        expect(errorsOf(date, { day: bad })).toEqual({ day: [{ key: "validation.invalid" }] });
      }
    });
  });

  describe("file (the upload step comes later)", () => {
    it("takes no answer for now: an optional file is left out, a required one is refused", () => {
      expect(
        errorsOf([field({ key: "attachment", type: "file" })], { attachment: "x.pdf" }),
      ).toBeNull();
      expect(errorsOf([field({ key: "attachment", type: "file", required: true })], {})).toEqual({
        attachment: [{ key: "validation.required" }],
      });
    });

    it("never stores an answer given for a file field", () => {
      const result = validateSubmission([field({ key: "attachment", type: "file" })], {
        attachment: "../../etc/passwd",
      });
      expect(result.ok && result.submission.data).toEqual({});
    });
  });

  it("reports every wrong field at once, and stores nothing", () => {
    const fields = [
      field({ key: "name", required: true }),
      field({ key: "mobile", required: true }),
      field({ key: "note", max: 3 }),
    ];
    expect(errorsOf(fields, { mobile: "1", note: "abcd" })).toEqual({
      name: [{ key: "validation.required" }],
      mobile: [{ key: "validation.phoneInvalid" }],
      note: [{ key: "validation.tooLong", values: { maximum: 3 } }],
    });
  });

  it("refuses a submission whose answers weigh too much", () => {
    const fields = Array.from({ length: 10 }, (_unused, index) =>
      field({ key: `f${index}`, type: "textarea", max: 5000 }),
    );
    const values = Object.fromEntries(fields.map((one) => [one.key, "x".repeat(2000)]));
    expect(errorsOf(fields, values)).toEqual({
      _form: [{ key: "validation.tooLong", values: { maximum: DATA_MAX_BYTES } }],
    });
  });
});
