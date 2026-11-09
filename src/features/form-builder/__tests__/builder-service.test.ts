import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  copyName,
  copySlug,
  createForm,
  deleteFormById,
  duplicateForm,
  mapFormError,
  saveForm,
  switchForm,
  toFormRow,
  type FormBuilderStore,
  type FormRow,
} from "../builder-service";
import { createFormSchema, updateFormSchema } from "../schemas";

const FORM = "00000000-0000-4000-b000-000000000002";
const PROJECT = "00000000-0000-4000-b000-000000000001";

const row = (extra: Partial<FormRow> = {}): FormRow => ({
  name: "Contact",
  slug: "contact",
  kind: "contact",
  placement: "contact",
  project_id: null,
  crm_integration_id: null,
  button_text: "Send message",
  success_message: null,
  fields: [{ label: "Name", key: "name", type: "text", required: true }],
  active: true,
  ...extra,
});

function store(extra: Partial<FormBuilderStore> = {}): FormBuilderStore {
  return {
    insert: vi.fn(async (made: FormRow) => ({ formId: FORM, slug: made.slug })),
    update: vi.fn(async (_id: string, made: FormRow) => ({ formId: FORM, slug: made.slug })),
    setActive: vi.fn(async () => ({ formId: FORM, slug: "contact" })),
    read: vi.fn(async () => row()),
    remove: vi.fn(async () => ({ formId: FORM, slug: "contact" })),
    ...extra,
  };
}

const slugTaken = () => mapFormError({ code: "23505" });

describe("UT-form-builder-service: the database's answers as action errors (S7-T08)", () => {
  it.each([
    [{ code: "23505" }, "VALIDATION"],
    [{ code: "23514" }, "VALIDATION"],
    [{ code: "P0002" }, "NOT_FOUND"],
    [{ code: "PGRST116" }, "NOT_FOUND"],
    [{ code: "42501" }, "FORBIDDEN"],
    [{ code: "XX000", message: "boom" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ])("maps %j to %s", (failure, code) => {
    expect(mapFormError(failure)).toMatchObject({ code });
  });

  it("puts a slug already used on the slug box, and never repeats the database's text", () => {
    expect(mapFormError({ code: "23505", message: "duplicate key forms_slug_key" })).toMatchObject({
      fieldErrors: { slug: [{ key: "validation.formSlugTaken" }] },
    });
    expect(mapFormError({ code: "XX000", message: "secret detail" }).message).not.toContain(
      "secret",
    );
  });
});

describe("UT-form-builder-service: what each action writes (S7-T08)", () => {
  it("writes the columns from the input, a blank box as null", async () => {
    const made = store();
    await createForm(
      made,
      createFormSchema.parse({
        name: "Contact",
        slug: "contact",
        kind: "contact",
        placement: "contact",
        buttonText: "",
        fields: [{ label: "Name", key: "name", type: "text" }],
      }),
    );
    expect(made.insert).toHaveBeenCalledWith({
      name: "Contact",
      slug: "contact",
      kind: "contact",
      placement: "contact",
      project_id: null,
      crm_integration_id: null,
      button_text: null,
      success_message: null,
      fields: [{ label: "Name", key: "name", type: "text", required: false }],
      active: true,
    });
  });

  it("keeps the project only for 'one project'", () => {
    const input = (placement: string) =>
      createFormSchema.parse({
        name: "Visit",
        slug: "visit",
        kind: "site_visit",
        placement,
        projectId: PROJECT,
        fields: [{ label: "Name", key: "name", type: "text" }],
      });
    expect(toFormRow(input("project_specific")).project_id).toBe(PROJECT);
    expect(toFormRow(input("project")).project_id).toBeNull();
    expect(toFormRow(input("none")).project_id).toBeNull();
  });

  it("saves by id, switches, and deletes through the store", async () => {
    const made = store();
    const update = updateFormSchema.parse({
      formId: FORM,
      name: "Contact",
      slug: "contact",
      kind: "contact",
      placement: "contact",
      fields: [{ label: "Name", key: "name", type: "text" }],
    });
    expect(await saveForm(made, update)).toEqual({ formId: FORM, slug: "contact" });
    expect(made.update).toHaveBeenCalledWith(FORM, expect.objectContaining({ slug: "contact" }));
    await switchForm(made, { formId: FORM, active: false });
    expect(made.setActive).toHaveBeenCalledWith(FORM, false);
    await deleteFormById(made, { formId: FORM });
    expect(made.remove).toHaveBeenCalledWith(FORM);
  });
});

describe("UT-form-builder-duplicate: the copy of a form (S7-T08)", () => {
  it("names the copy, cuts a long name and slug to the limits, and numbers the later tries", () => {
    expect(copyName("Contact")).toBe("Contact (copy)");
    expect(copyName("x".repeat(120))).toHaveLength(120);
    expect(copyName("x".repeat(120)).endsWith(" (copy)")).toBe(true);
    expect(copySlug("contact", 1)).toBe("contact-copy");
    expect(copySlug("contact", 3)).toBe("contact-copy-3");
    expect(copySlug("a".repeat(80), 1)).toHaveLength(80);
    expect(copySlug(`${"a".repeat(74)}-bcd`, 1).endsWith("-copy")).toBe(true);
  });

  it("copies everything but the name, the slug and the switch, which is off", async () => {
    const made = store({
      read: vi.fn(async () =>
        row({ project_id: PROJECT, crm_integration_id: FORM, placement: "project_specific" }),
      ),
    });
    expect(await duplicateForm(made, { formId: FORM })).toEqual({
      formId: FORM,
      slug: "contact-copy",
    });
    expect(made.insert).toHaveBeenCalledWith(
      row({
        name: "Contact (copy)",
        slug: "contact-copy",
        active: false,
        project_id: PROJECT,
        crm_integration_id: FORM,
        placement: "project_specific",
      }),
    );
  });

  it("says not found when there is no such form", async () => {
    const made = store({ read: vi.fn(async () => null) });
    await expect(duplicateForm(made, { formId: FORM })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(made.insert).not.toHaveBeenCalled();
  });

  it("tries the next numbered slug when the slug is taken", async () => {
    const insert = vi
      .fn()
      .mockRejectedValueOnce(slugTaken())
      .mockRejectedValueOnce(slugTaken())
      .mockImplementation(async (made: FormRow) => ({ formId: FORM, slug: made.slug }));
    const done = await duplicateForm(store({ insert }), { formId: FORM });
    expect(done.slug).toBe("contact-copy-3");
    expect(insert).toHaveBeenCalledTimes(3);
  });

  it("gives up after a few tries, and does not hide any other failure", async () => {
    const taken = vi.fn().mockRejectedValue(slugTaken());
    await expect(duplicateForm(store({ insert: taken }), { formId: FORM })).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(taken).toHaveBeenCalledTimes(6);
    const broken = vi.fn().mockRejectedValue(new ActionError("FORBIDDEN", "no"));
    await expect(duplicateForm(store({ insert: broken }), { formId: FORM })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(broken).toHaveBeenCalledTimes(1);
  });
});
