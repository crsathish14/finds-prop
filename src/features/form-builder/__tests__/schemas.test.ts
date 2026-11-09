import { describe, expect, it } from "vitest";
import { formFieldsSchema } from "@/features/forms";
import { toFieldErrors } from "@/server/actions/field-errors";
import { createFormSchema, updateFormSchema } from "../schemas";

const PROJECT = "00000000-0000-4000-b000-000000000001";
const FORM = "00000000-0000-4000-b000-000000000002";

const base = {
  name: "Contact",
  slug: "contact",
  kind: "contact",
  placement: "contact",
  fields: [{ label: "Name", key: "name", type: "text", required: true }],
};

const errorsOf = (input: unknown) => {
  const parsed = createFormSchema.safeParse(input);
  if (parsed.success) throw new Error("expected the input to be refused");
  return toFieldErrors(parsed.error, input);
};

describe("UT-form-builder-schemas: what the admin's builder sends (S7-T08)", () => {
  it("takes a form with one field, and makes it active unless told otherwise", () => {
    const parsed = createFormSchema.parse(base);
    expect(parsed).toMatchObject({ name: "Contact", slug: "contact", active: true });
    expect(parsed.fields).toEqual([{ label: "Name", key: "name", type: "text", required: true }]);
  });

  it("tidies the name and labels and reads blank optional boxes as no value", () => {
    const parsed = createFormSchema.parse({
      ...base,
      name: "  Site   visit ",
      buttonText: "  ",
      successMessage: "",
      crmIntegrationId: "",
      projectId: "",
      fields: [
        { label: "  Your   name ", key: "name", type: "text", placeholder: " ", required: false },
      ],
    });
    expect(parsed.name).toBe("Site visit");
    expect(parsed.buttonText).toBeNull();
    expect(parsed.successMessage).toBeNull();
    expect(parsed.crmIntegrationId).toBeNull();
    expect(parsed.fields[0]).toEqual({
      label: "Your name",
      key: "name",
      type: "text",
      required: false,
    });
  });

  it("keeps only what each kind of field uses: choices for choice fields, limits for text and numbers", () => {
    const parsed = createFormSchema.parse({
      ...base,
      fields: [
        {
          label: "Budget",
          key: "budget",
          type: "number",
          min: 10,
          max: 100,
          options: ["x"],
          placeholder: "Lakh",
        },
        { label: "City", key: "city", type: "dropdown", options: ["Chennai", "Madurai"], min: 1 },
        { label: "Consent", key: "consent", type: "checkbox", placeholder: "no" },
        { label: "Plan", key: "plan", type: "file", placeholder: "no", max: 5 },
      ],
    });
    expect(parsed.fields).toEqual([
      {
        label: "Budget",
        key: "budget",
        type: "number",
        min: 10,
        max: 100,
        placeholder: "Lakh",
        required: false,
      },
      {
        label: "City",
        key: "city",
        type: "dropdown",
        options: ["Chennai", "Madurai"],
        required: false,
      },
      { label: "Consent", key: "consent", type: "checkbox", required: false },
      { label: "Plan", key: "plan", type: "file", required: false },
    ]);
  });

  it("saves fields the stored shape accepts, so the pages can draw and check them", () => {
    const parsed = createFormSchema.parse({
      ...base,
      fields: [
        { label: "Name", key: "name", type: "text", required: true, min: 2, max: 80 },
        {
          label: "Interest",
          key: "interest",
          type: "dropdown",
          options: ["A", "B"],
          required: false,
        },
        { label: "Visit", key: "visit", type: "date", required: false },
      ],
    });
    expect(formFieldsSchema.safeParse(parsed.fields).success).toBe(true);
  });

  it("refuses a duplicate key and names the second field's key box", () => {
    const errors = errorsOf({
      ...base,
      fields: [
        { label: "Name", key: "name", type: "text" },
        { label: "Mobile", key: "mobile", type: "text" },
        { label: "Other name", key: "name", type: "text" },
      ],
    });
    expect(errors).toEqual({ "fields.2.key": [{ key: "validation.fieldKeyTaken" }] });
  });

  it("refuses a key that is not lower case letters, digits and underscores starting with a letter", () => {
    for (const key of ["Name", "1st", "full name", "a-b", ""]) {
      const errors = errorsOf({ ...base, fields: [{ label: "X", key, type: "text" }] });
      expect(Object.keys(errors)).toEqual(["fields.0.key"]);
    }
  });

  it("needs choices for a dropdown or radio, each different, and a smallest value not above the largest", () => {
    expect(errorsOf({ ...base, fields: [{ label: "X", key: "x", type: "dropdown" }] })).toEqual({
      "fields.0.options": [{ key: "validation.optionsRequired" }],
    });
    expect(
      errorsOf({
        ...base,
        fields: [{ label: "X", key: "x", type: "radio", options: ["a", " A "] }],
      }),
    ).toEqual({ "fields.0.options": [{ key: "validation.optionsDuplicate" }] });
    expect(
      errorsOf({ ...base, fields: [{ label: "X", key: "x", type: "number", min: 9, max: 3 }] }),
    ).toEqual({ "fields.0.max": [{ key: "validation.rangeOrder" }] });
    expect(
      createFormSchema.safeParse({
        ...base,
        fields: [{ label: "X", key: "x", type: "checkbox" }],
      }).success,
    ).toBe(true);
  });

  it("needs at least one field, and no more than 30", () => {
    expect(errorsOf({ ...base, fields: [] })).toEqual({
      fields: [{ key: "validation.fieldsRequired" }],
    });
    const many = Array.from({ length: 31 }, (_unused, index) => ({
      label: `Q${index}`,
      key: `q${index}`,
      type: "text",
    }));
    expect(createFormSchema.safeParse({ ...base, fields: many }).success).toBe(false);
    expect(createFormSchema.safeParse({ ...base, fields: many.slice(0, 30) }).success).toBe(true);
  });

  it("needs a project for 'one project', and only then", () => {
    expect(errorsOf({ ...base, placement: "project_specific" })).toEqual({
      projectId: [{ key: "validation.projectRequired" }],
    });
    expect(
      createFormSchema.safeParse({ ...base, placement: "project_specific", projectId: PROJECT })
        .success,
    ).toBe(true);
  });

  it("refuses a slug that is not lower case words with single hyphens, a name that is too short and a kind it does not know", () => {
    expect(Object.keys(errorsOf({ ...base, slug: "Contact Us" }))).toEqual(["slug"]);
    expect(Object.keys(errorsOf({ ...base, slug: "-x" }))).toEqual(["slug"]);
    expect(Object.keys(errorsOf({ ...base, name: " a " }))).toEqual(["name"]);
    expect(Object.keys(errorsOf({ ...base, kind: "survey" }))).toEqual(["kind"]);
    expect(Object.keys(errorsOf({ ...base, placement: "footer" }))).toEqual(["placement"]);
  });

  it("limits the button text and the success message", () => {
    expect(Object.keys(errorsOf({ ...base, buttonText: "x".repeat(41) }))).toEqual(["buttonText"]);
    expect(Object.keys(errorsOf({ ...base, successMessage: "x".repeat(301) }))).toEqual([
      "successMessage",
    ]);
  });

  it("takes the id of the form on an update, and refuses one that is not an id", () => {
    expect(updateFormSchema.parse({ ...base, formId: FORM.toUpperCase() }).formId).toBe(FORM);
    expect(updateFormSchema.safeParse({ ...base, formId: "nope" }).success).toBe(false);
  });
});
