import { describe, expect, it } from "vitest";
import { PROPERTY_TYPES } from "@/features/project-editor/constants";
import { PROJECT_FIELD_PROPERTY_TYPES, SITE_SETTING_SCHEMAS } from "@/features/site/schemas";
import { SITE_DEFAULTS } from "@/features/site/defaults";
import { mergeSiteSettings } from "@/features/site/merge";
import { createLogger } from "@/server/logger";
import {
  projectFieldsValue,
  saveProjectFieldsContent,
  type ContentStore,
} from "../content-service";
import { projectFieldsInputSchema } from "../schemas";

const log = createLogger({ requestId: "test" });
const field = (patch: Record<string, unknown> = {}) => ({
  id: "fabc123456",
  label: "Approval number",
  hint: "",
  required: false,
  appliesTo: [],
  on: true,
  ...patch,
});

function fakeStore() {
  const writes: { key: string; value: Record<string, unknown> }[] = [];
  const store: ContentStore = {
    write: (key, value) => {
      writes.push({ key, value });
      return Promise.resolve();
    },
    readBounds: () => Promise.resolve(SITE_DEFAULTS.region.bounds),
  };
  return { store, writes };
}

describe("UT-project-fields: the extra project form boxes (ADR-168)", () => {
  it("keeps the property types the box can be limited to equal to the project form's", () => {
    expect([...PROJECT_FIELD_PROPERTY_TYPES]).toEqual([...PROPERTY_TYPES]);
  });

  it("starts with no boxes", () => {
    expect(SITE_DEFAULTS.project_fields).toEqual({ fields: [] });
    expect(mergeSiteSettings([], log).project_fields).toEqual({ fields: [] });
  });

  it("stores the boxes in order, leaving out a blank hint and repeated types", () => {
    const input = projectFieldsInputSchema.parse({
      fields: [
        field({ appliesTo: ["plot", "plot", "villa"], required: true }),
        field({ id: "fdef654321", label: "Second", hint: " Shown under it " }),
      ],
    });
    expect(projectFieldsValue(input)).toEqual({
      fields: [
        {
          id: "fabc123456",
          label: "Approval number",
          required: true,
          appliesTo: ["plot", "villa"],
          on: true,
        },
        {
          id: "fdef654321",
          label: "Second",
          hint: "Shown under it",
          required: false,
          appliesTo: [],
          on: true,
        },
      ],
    });
  });

  it("saves the row named project_fields, in the shape the site reads", async () => {
    const { store, writes } = fakeStore();
    const done = await saveProjectFieldsContent(
      store,
      projectFieldsInputSchema.parse({ fields: [field()] }),
    );
    expect(done).toEqual({ key: "project_fields" });
    expect(SITE_SETTING_SCHEMAS.project_fields.safeParse(writes[0]?.value).success).toBe(true);
  });

  it("refuses an eleventh box, a missing label, an unknown type, and a repeated label or id", () => {
    const ten = Array.from({ length: 10 }, (_, index) =>
      field({ id: "f00000000" + index, label: "Box " + index }),
    );
    expect(projectFieldsInputSchema.safeParse({ fields: ten }).success).toBe(true);
    const eleven = [...ten, field({ id: "f000000010", label: "Box 10" })];
    expect(projectFieldsInputSchema.safeParse({ fields: eleven }).success).toBe(false);
    expect(projectFieldsInputSchema.safeParse({ fields: [field({ label: "  " })] }).success).toBe(
      false,
    );
    expect(
      projectFieldsInputSchema.safeParse({ fields: [field({ appliesTo: ["castle"] })] }).success,
    ).toBe(false);
    expect(
      projectFieldsInputSchema.safeParse({
        fields: [field(), field({ id: "fdef654321", label: "APPROVAL number" })],
      }).success,
    ).toBe(false);
    expect(
      projectFieldsInputSchema.safeParse({ fields: [field(), field({ label: "Other" })] }).success,
    ).toBe(false);
    expect(projectFieldsInputSchema.safeParse({ fields: [field({ id: "Bad Id!" })] }).success).toBe(
      false,
    );
  });

  it("ignores a stored row that does not fit, so the form shows no extra boxes", () => {
    const merged = mergeSiteSettings(
      [{ key: "project_fields", value: { fields: [{ id: "x", label: 5 }] } }],
      log,
    );
    expect(merged.project_fields).toEqual({ fields: [] });
  });
});
