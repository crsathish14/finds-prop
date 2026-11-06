import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTACT_FORM, CONTACT_FORM_SLUG } from "../contact-form";
import { formFieldsSchema } from "../schemas";
import { validateSubmission } from "../validate";

const MIGRATION = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261106140000_default_contact_form.sql",
);

describe("UT-contact-form: the contact page's form (S5-T05)", () => {
  it("is a form the server accepts: contact placement, and fields that fit the schema", () => {
    expect(CONTACT_FORM.slug).toBe(CONTACT_FORM_SLUG);
    expect(CONTACT_FORM.placement).toBe("contact");
    expect(CONTACT_FORM.kind).toBe("contact");
    expect(formFieldsSchema.safeParse(CONTACT_FORM.fields).success).toBe(true);
  });

  it("needs only a name and a mobile, and asks for the rest if given", () => {
    const required = CONTACT_FORM.fields.filter((one) => one.required).map((one) => one.key);
    expect(required).toEqual(["name", "mobile"]);
    const result = validateSubmission(CONTACT_FORM.fields, {
      name: "Priya Raman",
      mobile: "98400 12345",
      email: "",
      interest: "",
      message: "",
    });
    expect(result).toEqual({
      ok: true,
      submission: { name: "Priya Raman", mobile: "9840012345", email: null, data: {} },
    });
  });

  it("takes one of its five choices and refuses anything else", () => {
    const answers = { name: "Priya Raman", mobile: "9840012345" };
    expect(
      validateSubmission(CONTACT_FORM.fields, { ...answers, interest: "A new project" }).ok,
    ).toBe(true);
    expect(validateSubmission(CONTACT_FORM.fields, { ...answers, interest: "Free money" }).ok).toBe(
      false,
    );
    const interest = CONTACT_FORM.fields.find((one) => one.key === "interest");
    expect(interest?.options).toHaveLength(5);
  });

  it("has no file field until the upload step is built", () => {
    expect(CONTACT_FORM.fields.some((one) => one.type === "file")).toBe(false);
  });

  it("is the same list the migration stores, so the database accepts exactly what the page draws", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const stored: unknown = JSON.parse(/\$fields\$([\s\S]*?)\$fields\$/.exec(sql)?.[1] ?? "null");
    expect(formFieldsSchema.parse(stored)).toEqual(CONTACT_FORM.fields);
    expect(sql).toContain("'contact',\n  'contact',\n  'contact',");
    expect(sql).toContain("on conflict (slug) do nothing");
  });
});
