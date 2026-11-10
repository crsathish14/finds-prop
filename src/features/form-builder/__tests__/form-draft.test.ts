import { describe, expect, it } from "vitest";
import {
  blankDraft,
  countProblems,
  draftOfField,
  duplicateKeyProblems,
  firstFieldWithProblem,
  freeKey,
  keyFromLabel,
  payloadOf,
  presetDraft,
  previewFieldsOf,
  problemsOf,
  settingsOfForm,
  slugFromName,
  without,
} from "../form-draft";
import { field } from "./fields";
import { createFormSchema } from "../schemas";
import type { FormField } from "@/features/forms";
import type { AdminFormView } from "../view";

const stored: AdminFormView = {
  id: "00000000-0000-4000-b000-000000000001",
  name: "Contact",
  slug: "contact",
  kind: "contact",
  placement: "contact",
  projectId: null,
  projectName: null,
  crmIntegrationId: "00000000-0000-4000-b000-0000000000c1",
  crmName: "Sample CRM",
  buttonText: "Send message",
  successMessage: null,
  active: true,
  fields: [
    field({ label: "Name", key: "name", type: "text", required: true, placeholder: "Your name" }),
    field({ label: "City", key: "city", type: "dropdown", options: ["Chennai", "Madurai"] }),
    field({ label: "Budget", key: "budget", type: "number", min: 10, max: 500 }),
  ],
  skippedFields: 0,
};

describe("a stored form as boxes (S7-T08)", () => {
  it("turns a field into text boxes: choices one on each line, limits as text", () => {
    expect(draftOfField(stored.fields[1] as FormField, "f1")).toMatchObject({
      id: "f1",
      key: "city",
      options: "Chennai\nMadurai",
      min: "",
      required: false,
    });
    expect(draftOfField(stored.fields[2] as FormField, "f2")).toMatchObject({
      min: "10",
      max: "500",
      options: "",
    });
  });

  it("starts a new form as an enquiry form shown nowhere, switched on", () => {
    expect(settingsOfForm(null)).toMatchObject({
      name: "",
      kind: "enquiry",
      placement: "none",
      active: true,
    });
  });

  it("fills the settings from a stored form, with blanks for what is not set", () => {
    expect(settingsOfForm(stored)).toMatchObject({
      name: "Contact",
      placement: "contact",
      projectId: "",
      crmIntegrationId: "00000000-0000-4000-b000-0000000000c1",
      successMessage: "",
    });
  });
});

describe("keys, slugs and quick adds", () => {
  it("suggests a key from a label: lower case, underscores, starting with a letter, at most 40", () => {
    expect(keyFromLabel("Mobile number")).toBe("mobile_number");
    expect(keyFromLabel("  Your  E-mail! ")).toBe("your_e_mail");
    expect(keyFromLabel("3 BHK")).toBe("f_3_bhk");
    expect(keyFromLabel("???")).toBe("");
    expect(keyFromLabel("a".repeat(60))).toHaveLength(40);
  });

  it("suggests a slug from a name: lower case words joined by hyphens", () => {
    expect(slugFromName("Kadal Vista site visit")).toBe("kadal-vista-site-visit");
    expect(slugFromName("  Brochure   download ")).toBe("brochure-download");
    expect(slugFromName("!!")).toBe("");
  });

  it("makes the field a quick add stands for, with the chip's word as its label", () => {
    expect(presetDraft("q1", "mobile", "Mobile")).toMatchObject({
      label: "Mobile",
      key: "mobile",
      type: "text",
      required: true,
    });
    expect(presetDraft("q2", "bhk", "BHK")).toMatchObject({
      type: "dropdown",
      options: "1 BHK\n2 BHK\n3 BHK\n4 BHK",
    });
  });

  it("finds a key that no other field uses: the base, then base_2, base_3 ...", () => {
    const used = [
      { ...blankDraft("a"), key: "name" },
      { ...blankDraft("b"), key: "name_2" },
    ];
    expect(freeKey("email", used)).toBe("email");
    expect(freeKey("name", used)).toBe("name_3");
  });
});

describe("what the save action takes", () => {
  const drafts = [
    { ...blankDraft("a"), label: "Name", key: "name", required: true, placeholder: "Your name" },
    {
      ...blankDraft("b"),
      label: "City",
      key: "city",
      type: "dropdown",
      options: " Chennai \n\nMadurai\n",
      min: "5",
    },
    { ...blankDraft("c"), label: "Budget", key: "budget", type: "number", min: "10", max: "x" },
    { ...blankDraft("d"), label: "Email", key: "email", type: "email", options: "left over" },
  ];
  const payload = payloadOf({ ...settingsOfForm(null), name: "Enquiry", slug: "enquiry" }, drafts);

  it("sends choices as a list, only for the kinds that use them", () => {
    expect(payload.fields[1]).toMatchObject({ options: ["Chennai", "Madurai"] });
    expect(payload.fields[3]).not.toHaveProperty("options");
  });

  it("sends limits as numbers, only for text, textarea and number; a blank is no limit; text that is not a number goes on as typed", () => {
    expect(payload.fields[2]).toMatchObject({ min: 10, max: "x" });
    expect(payload.fields[0]).toMatchObject({ min: null, max: null });
    expect(payload.fields[1]).not.toHaveProperty("min");
    expect(payload.fields[3]).not.toHaveProperty("min");
  });

  it("sends the project only when the placement is one project", () => {
    const base = { ...settingsOfForm(null), name: "Contact", slug: "contact", projectId: "p1" };
    expect(payloadOf({ ...base, placement: "contact" }, []).projectId).toBe("");
    expect(payloadOf({ ...base, placement: "project_specific" }, []).projectId).toBe("p1");
  });

  it("is accepted by the schema, with the leftover options of an email field dropped", () => {
    const parsed = createFormSchema.safeParse({
      ...payload,
      fields: payload.fields.filter((field) => field.key !== "budget"),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.fields.map((field) => field.key)).toEqual(["name", "city", "email"]);
      expect(parsed.data.fields[2]).not.toHaveProperty("options");
    }
  });
});

describe("the live preview's fields", () => {
  it("draws only fields that have a label, in order, with their choices and limits", () => {
    const fields = previewFieldsOf(
      [
        { ...blankDraft("a"), label: "Name", key: "name", required: true },
        blankDraft("b"),
        {
          ...blankDraft("c"),
          label: "City",
          type: "dropdown",
          options: "Chennai\nMadurai",
          placeholder: "Choose",
        },
        { ...blankDraft("d"), label: "Budget", type: "number", min: "10", max: "" },
      ],
      ["text", "number", "dropdown"],
    );
    expect(fields.map((field) => field.label)).toEqual(["Name", "City", "Budget"]);
    expect(fields[1]).toMatchObject({ key: "c", options: ["Chennai", "Madurai"] });
    expect(fields[2]).toMatchObject({ min: 10, max: undefined });
  });
});

describe("putting the server's problems on the boxes", () => {
  const drafts = [
    { ...blankDraft("first"), label: "Name", key: "name" },
    { ...blankDraft("second"), label: "City", key: "city", type: "dropdown" },
  ];

  it("puts a path on its Settings box, a field's path on that field's box, by the field's id", () => {
    const found = problemsOf(
      {
        slug: "Slug used",
        "fields.1.options": "Add at least one choice.",
        "fields.0.key": "Key used",
        "fields.1.options.0": "Second message for the same box",
      },
      drafts,
    );
    expect(found.settings).toEqual({ slug: "Slug used" });
    expect(found.fields).toEqual({
      first: { key: "Key used" },
      second: { options: "Add at least one choice." },
    });
    expect(found.form).toEqual([]);
    expect(countProblems(found)).toBe(3);
  });

  it("keeps what has no box (no fields at all, an unknown path) for the form as a whole", () => {
    const found = problemsOf(
      { fields: "Add at least one field.", _form: "Not saved", "fields.9.key": "Gone" },
      drafts,
    );
    expect(found.form).toEqual(["Add at least one field.", "Not saved", "Gone"]);
    expect(found.settings).toEqual({});
  });

  it("finds the first field with a problem, so its row can be opened", () => {
    const found = problemsOf({ "fields.1.options": "x" }, drafts);
    expect(firstFieldWithProblem(found, drafts)).toBe("second");
    expect(firstFieldWithProblem(problemsOf({}, drafts), drafts)).toBeNull();
  });

  it("finds a key used twice: the second field gets the problem, naming the key", () => {
    const twice = duplicateKeyProblems(
      [
        { ...blankDraft("one"), key: "name" },
        { ...blankDraft("two"), key: "mobile" },
        { ...blankDraft("three"), key: "name" },
        { ...blankDraft("four"), key: "" },
        { ...blankDraft("five"), key: "" },
      ],
      (key) => `Key "${key}" is already used by another field.`,
    );
    expect(twice).toEqual({ three: { key: 'Key "name" is already used by another field.' } });
  });

  it("copies a record without one key", () => {
    expect(without({ slug: "a", name: "b" }, "slug")).toEqual({ name: "b" });
  });
});
