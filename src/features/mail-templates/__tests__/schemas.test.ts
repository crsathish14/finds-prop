import { describe, expect, it } from "vitest";
import { MAIL_BODY_MAX, MAIL_SUBJECT_MAX } from "@/lib/mail-template";
import { toFieldErrors } from "@/server/actions/field-errors";
import { MAIL_TEMPLATE_SETTING_KEYS } from "../constants";
import { mailRowSchema, mailTemplateInputSchema } from "../schemas";

const valid = {
  kind: "enquiry_poster",
  subject: "A new enquiry from {enquirerName}",
  body: "Hello,\n\n{enquirerName} wrote about {propertyTitle}.\n{dashboardLink}",
  publish: false,
};

function problems(input: unknown) {
  const parsed = mailTemplateInputSchema.safeParse(input);
  if (parsed.success) return {};
  return toFieldErrors(parsed.error, input);
}

describe("UT-mail-template-schemas: what the editor may save (ADR-183)", () => {
  it("accepts wording that keeps the rules and makes Windows line breaks plain", () => {
    const parsed = mailTemplateInputSchema.parse({
      ...valid,
      subject: "  A new enquiry from {enquirerName}  ",
      body: "Line one {enquirerName}\r\nLine two",
    });
    expect(parsed.subject).toBe("A new enquiry from {enquirerName}");
    expect(parsed.body).toBe("Line one {enquirerName}\nLine two");
  });

  it("stores the two mails in rows of their own, with names the key rule allows", () => {
    expect(MAIL_TEMPLATE_SETTING_KEYS).toEqual({
      enquiry_poster: "mail_enquiry_poster",
      enquiry_sender: "mail_enquiry_sender",
    });
    for (const key of Object.values(MAIL_TEMPLATE_SETTING_KEYS)) {
      expect(key).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("refuses a placeholder the mail does not allow, saying which box", () => {
    expect(problems({ ...valid, body: "Call them: {phone} {enquirerName}" })).toEqual({
      body: [{ key: "validation.mailPlaceholderUnknown" }],
    });
    expect(problems({ ...valid, kind: "enquiry_sender", body: "See {dashboardLink}" })).toEqual({
      body: [{ key: "validation.mailPlaceholderUnknown" }],
    });
  });

  it("refuses a poster mail with no name in it", () => {
    expect(problems({ ...valid, subject: "A new enquiry", body: "Open your dashboard." })).toEqual({
      body: [{ key: "validation.mailPlaceholderMissing" }],
    });
    expect(
      problems({ ...valid, kind: "enquiry_sender", subject: "Sent", body: "We sent it." }),
    ).toEqual({});
  });

  it("refuses empty boxes and boxes over the limit, with the limit in the words", () => {
    const empty = problems({ ...valid, subject: "   ", body: "" });
    expect(empty["subject"]?.[0]).toEqual({ key: "validation.required" });
    expect(empty["body"]?.[0]).toEqual({ key: "validation.required" });
    expect(problems({ ...valid, subject: "a".repeat(MAIL_SUBJECT_MAX + 1) })).toMatchObject({
      subject: [{ key: "validation.tooLong", values: { maximum: MAIL_SUBJECT_MAX } }],
    });
    expect(problems({ ...valid, body: "a".repeat(MAIL_BODY_MAX + 1) })).toMatchObject({
      body: [{ key: "validation.tooLong", values: { maximum: MAIL_BODY_MAX } }],
    });
    expect(
      problems({ ...valid, subject: "a".repeat(MAIL_SUBJECT_MAX) + "{enquirerName}" }),
    ).not.toEqual({});
  });

  it("refuses control characters: a line break in the subject, a bell or a direction mark anywhere", () => {
    expect(problems({ ...valid, subject: "Hi {enquirerName}\nBcc: x" })).toEqual({
      subject: [{ key: "validation.invalid" }],
    });
    expect(problems({ ...valid, body: "Hi {enquirerName}\u0007" })).toEqual({
      body: [{ key: "validation.invalid" }],
    });
    expect(problems({ ...valid, body: "Hi {enquirerName}‮" })).toEqual({
      body: [{ key: "validation.invalid" }],
    });
  });

  it("refuses an unknown mail and a save with no publish flag", () => {
    expect(problems({ ...valid, kind: "other" })).toHaveProperty("kind");
    expect(problems({ ...valid, publish: undefined })).toHaveProperty("publish");
    expect(problems({ ...valid, subject: undefined })).toHaveProperty("subject");
  });
});

describe("UT-mail-template-schemas: a stored row (ADR-183)", () => {
  const published = {
    subject: "From {enquirerName}",
    body: "Hello {enquirerName}",
    updated: "2026-11-24",
  };

  it("accepts a published version, a working copy, both, or neither", () => {
    const schema = mailRowSchema("enquiry_poster");
    expect(schema.safeParse({ published }).success).toBe(true);
    expect(schema.safeParse({ working: { ...published, updated: null } }).success).toBe(true);
    expect(schema.safeParse({ published, working: { ...published, updated: null } }).success).toBe(
      true,
    );
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("does not accept a row that breaks a rule or is not in the shape", () => {
    const schema = mailRowSchema("enquiry_poster");
    expect(
      schema.safeParse({ published: { ...published, body: "{phone} {enquirerName}" } }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ published: { ...published, subject: "No name", body: "No name" } })
        .success,
    ).toBe(false);
    expect(schema.safeParse({ published: { ...published, updated: "yesterday" } }).success).toBe(
      false,
    );
    expect(schema.safeParse({ published: { subject: 5 } }).success).toBe(false);
    expect(schema.safeParse("text").success).toBe(false);
  });

  it("checks each mail against its own placeholders", () => {
    expect(
      mailRowSchema("enquiry_sender").safeParse({
        published: { ...published, body: "{dashboardLink}" },
      }).success,
    ).toBe(false);
    expect(
      mailRowSchema("enquiry_poster").safeParse({
        published: { ...published, body: "{dashboardLink} {enquirerName}" },
      }).success,
    ).toBe(true);
  });
});
