import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAIL_TEMPLATES,
  MAIL_BODY_MAX,
  MAIL_PLACEHOLDERS,
  MAIL_SAMPLE_VALUES,
  MAIL_SUBJECT_MAX,
  MAIL_TEMPLATE_KINDS,
  MAIL_TEMPLATE_PLACEHOLDERS,
  cleanMailValue,
  mailTemplateProblems,
  placeholdersIn,
  renderMailTemplate,
  type MailTemplateValues,
} from "../mail-template";

const values: MailTemplateValues = {
  enquirerName: "Test Person",
  propertyTitle: "A test home",
  propertyLink: "https://example.test/properties/a-test-home",
  dashboardLink: "https://example.test/dashboard/enquiries",
  siteName: "testsite",
};

describe("UT-mail-template: the rules (ADR-183)", () => {
  it("finds the words in curly brackets, in order", () => {
    expect(placeholdersIn("Hi {enquirerName}, see {propertyLink} and {propertyLink}.")).toEqual([
      "enquirerName",
      "propertyLink",
      "propertyLink",
    ]);
    expect(placeholdersIn("No brackets, a lone } and a lone { are plain text.")).toEqual([]);
    expect(placeholdersIn("{ enquirerName } and {}")).toEqual([" enquirerName ", ""]);
  });

  it.each(MAIL_TEMPLATE_KINDS)("the wording in code for %s keeps every rule", (kind) => {
    expect(mailTemplateProblems(kind, DEFAULT_MAIL_TEMPLATES[kind])).toEqual([]);
  });

  it("names five placeholders, and the dashboard link is for the poster only", () => {
    expect(MAIL_PLACEHOLDERS).toHaveLength(5);
    expect(MAIL_TEMPLATE_PLACEHOLDERS.enquiry_poster).toContain("dashboardLink");
    expect(MAIL_TEMPLATE_PLACEHOLDERS.enquiry_sender).not.toContain("dashboardLink");
  });

  it("refuses a placeholder the mail does not allow, in the subject or the body", () => {
    const poster = { subject: "From {enquirerName}", body: "See {phone}" };
    expect(mailTemplateProblems("enquiry_poster", poster)).toEqual([
      { field: "body", reason: "unknownPlaceholder" },
    ]);
    const sender = { subject: "About {propertyTitle}", body: "Go to {dashboardLink}" };
    expect(mailTemplateProblems("enquiry_sender", sender)).toEqual([
      { field: "body", reason: "unknownPlaceholder" },
    ]);
    expect(
      mailTemplateProblems("enquiry_sender", { subject: "{ propertyTitle }", body: "Hello" }),
    ).toEqual([{ field: "subject", reason: "unknownPlaceholder" }]);
  });

  it("requires the name in the poster mail, in the subject or the body, but not in the enquirer mail", () => {
    expect(
      mailTemplateProblems("enquiry_poster", { subject: "A new enquiry", body: "Open it." }),
    ).toEqual([{ field: "body", reason: "missingPlaceholder" }]);
    expect(
      mailTemplateProblems("enquiry_poster", { subject: "From {enquirerName}", body: "Open it." }),
    ).toEqual([]);
    expect(
      mailTemplateProblems("enquiry_poster", {
        subject: "A new enquiry",
        body: "From {enquirerName}",
      }),
    ).toEqual([]);
    expect(
      mailTemplateProblems("enquiry_sender", { subject: "Sent", body: "We sent it." }),
    ).toEqual([]);
  });

  it("refuses empty boxes, boxes over the limit and control characters (a body may have line breaks)", () => {
    const base = { subject: "From {enquirerName}", body: "Line one\nLine two\r\nLine three" };
    expect(mailTemplateProblems("enquiry_poster", base)).toEqual([]);
    expect(mailTemplateProblems("enquiry_poster", { ...base, subject: "  " })).toContainEqual({
      field: "subject",
      reason: "empty",
    });
    expect(mailTemplateProblems("enquiry_poster", { ...base, body: "" })).toContainEqual({
      field: "body",
      reason: "empty",
    });
    expect(
      mailTemplateProblems("enquiry_poster", {
        ...base,
        subject: `{enquirerName}${"a".repeat(MAIL_SUBJECT_MAX)}`,
      }),
    ).toContainEqual({ field: "subject", reason: "tooLong" });
    expect(
      mailTemplateProblems("enquiry_poster", {
        ...base,
        body: `{enquirerName}${"a".repeat(MAIL_BODY_MAX)}`,
      }),
    ).toContainEqual({ field: "body", reason: "tooLong" });
    expect(
      mailTemplateProblems("enquiry_poster", { ...base, subject: "From {enquirerName}\nBcc: x" }),
    ).toContainEqual({ field: "subject", reason: "badCharacters" });
    expect(
      mailTemplateProblems("enquiry_poster", { ...base, body: "Hello {enquirerName}\u0007" }),
    ).toContainEqual({ field: "body", reason: "badCharacters" });
    expect(
      mailTemplateProblems("enquiry_poster", { ...base, body: "Hello {enquirerName}‮" }),
    ).toContainEqual({ field: "body", reason: "badCharacters" });
  });

  it("makes a value one clean line", () => {
    expect(cleanMailValue("  A\r\nB\tC\u0000D‮e  ")).toBe("A B C D e");
    expect(cleanMailValue("")).toBe("");
  });
});

describe("UT-mail-template-render: filling a template in (ADR-183)", () => {
  it("fills every placeholder of the poster's wording in code, with no leftover brackets", () => {
    const mail = renderMailTemplate(
      "enquiry_poster",
      DEFAULT_MAIL_TEMPLATES.enquiry_poster,
      values,
    );
    expect(mail.fellBack).toBe(false);
    expect(mail.subject).toBe("You got an enquiry from Test Person");
    expect(mail.text).toContain(
      "Someone named Test Person sent an enquiry about A test home on testsite.",
    );
    expect(mail.text).toContain("https://example.test/dashboard/enquiries");
    expect(mail.text).toContain("https://example.test/properties/a-test-home");
    expect(`${mail.subject}${mail.text}`).not.toMatch(/[{}]/);
  });

  it("fills the enquirer's wording in code, with no dashboard link", () => {
    const forSender = { ...values, dashboardLink: undefined };
    const mail = renderMailTemplate(
      "enquiry_sender",
      DEFAULT_MAIL_TEMPLATES.enquiry_sender,
      forSender,
    );
    expect(mail.subject).toBe("We sent your enquiry about A test home");
    expect(mail.text).toContain("Hello Test Person,");
    expect(mail.text).toContain("https://example.test/properties/a-test-home");
    expect(mail.text).not.toContain("dashboard");
  });

  it("puts no phone number and no enquiry text in the wording in code", () => {
    for (const kind of MAIL_TEMPLATE_KINDS) {
      const { subject, body } = DEFAULT_MAIL_TEMPLATES[kind];
      expect(`${subject} ${body}`).not.toMatch(/phone|mobile|message|\d{6,}/i);
      expect(placeholdersIn(`${subject} ${body}`).every((name) => name in MAIL_SAMPLE_VALUES)).toBe(
        true,
      );
    }
  });

  it("uses an admin's wording, a placeholder twice, and keeps its line breaks", () => {
    const mail = renderMailTemplate(
      "enquiry_poster",
      {
        subject: "{enquirerName} wrote ({siteName})",
        body: "{enquirerName}\n\n{enquirerName} again\n{propertyTitle}",
      },
      values,
    );
    expect(mail).toEqual({
      subject: "Test Person wrote (testsite)",
      text: "Test Person\n\nTest Person again\nA test home",
      fellBack: false,
    });
  });

  it("cannot be made to add a line to the subject or a header through a name", () => {
    const mail = renderMailTemplate("enquiry_poster", DEFAULT_MAIL_TEMPLATES.enquiry_poster, {
      ...values,
      enquirerName: "Eve\r\nBcc: someone@example.test\nSubject: other",
    });
    expect(mail.subject).toBe(
      "You got an enquiry from Eve Bcc: someone@example.test Subject: other",
    );
    expect(mail.subject).not.toMatch(/[\r\n]/);
  });

  it("does not fill in a placeholder that a value brought along", () => {
    const mail = renderMailTemplate("enquiry_poster", DEFAULT_MAIL_TEMPLATES.enquiry_poster, {
      ...values,
      enquirerName: "{siteName}",
    });
    expect(mail.subject).toBe("You got an enquiry from {siteName}");
  });

  it("falls back to the wording in code, and says so, when a saved template breaks a rule", () => {
    const broken = [
      { subject: "Hi {enquirerName}", body: "Call {phone}" },
      { subject: "A new enquiry", body: "No name here." },
      { subject: "Hi {enquirerName}\nBcc: x", body: "Body" },
      { subject: "", body: "Body {enquirerName}" },
    ];
    const expected = renderMailTemplate(
      "enquiry_poster",
      DEFAULT_MAIL_TEMPLATES.enquiry_poster,
      values,
    );
    for (const template of broken) {
      const mail = renderMailTemplate("enquiry_poster", template, values);
      expect(mail).toEqual({ subject: expected.subject, text: expected.text, fellBack: true });
    }
  });

  it("falls back when the filled wording would be empty, so no blank mail goes out", () => {
    const mail = renderMailTemplate(
      "enquiry_poster",
      { subject: "{dashboardLink}", body: "From {enquirerName}" },
      { ...values, dashboardLink: undefined },
    );
    expect(mail.fellBack).toBe(true);
    expect(mail.subject).toBe("You got an enquiry from Test Person");
  });

  it("renders both mails with the sample values the screen previews with", () => {
    for (const kind of MAIL_TEMPLATE_KINDS) {
      const mail = renderMailTemplate(kind, DEFAULT_MAIL_TEMPLATES[kind], MAIL_SAMPLE_VALUES);
      expect(mail.fellBack).toBe(false);
      expect(mail.subject).toContain(kind === "enquiry_poster" ? "Sample Name" : "Sample Nagar");
    }
  });
});
