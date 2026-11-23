import { describe, expect, it } from "vitest";
import { DEFAULT_MAIL_TEMPLATES, renderMailTemplate } from "..";

describe("UT-mail-render: the mail module hands out the renderer (ADR-183)", () => {
  it("renders without sending or reading anything", () => {
    const mail = renderMailTemplate("enquiry_sender", DEFAULT_MAIL_TEMPLATES.enquiry_sender, {
      enquirerName: "Test Person",
      propertyTitle: "A test home",
      propertyLink: "https://example.test/p",
      siteName: "testsite",
    });
    expect(mail.subject).toBe("We sent your enquiry about A test home");
    expect(mail.fellBack).toBe(false);
  });
});
