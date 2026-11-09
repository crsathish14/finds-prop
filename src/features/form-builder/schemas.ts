import { z } from "zod";
import { FIELD_TYPES, FORM_KINDS, FORM_PLACEMENTS } from "@/features/forms";
import {
  BUTTON_TEXT_MAX,
  FIELD_COUNT_MAX,
  FIELD_LABEL_MAX,
  FORM_NAME_MAX,
  OPTION_MAX,
  OPTIONS_MAX,
  PLACEHOLDER_MAX,
  SUCCESS_MESSAGE_MAX,
} from "./constants";

/**
 * What the admin's form builder sends (S7-T08, FR-ADM-08, BR-60). Nothing here says who is saving: the admin is the
 * signed-in session (R-BE-03). A schema message is a key under `validation.*`; the screen looks the words up
 * (ADR-035). The field list has the same shape as the stored one (`forms.fields`, checked again when a visitor
 * submits), so what is saved here is always drawn and checked by the pages.
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

/** A blank box clears an optional text (null); a value not given is left out. */
const clearable = <T extends z.ZodType>(rule: T) =>
  z
    .preprocess(
      (typed) => (typeof typed === "string" && typed.trim() === "" ? null : typed),
      rule.nullable(),
    )
    .optional();

/** The kinds of field that offer choices, and the ones each limit belongs to. */
const CHOICE_TYPES: readonly string[] = ["dropdown", "radio", "checkbox"];
const LENGTH_TYPES: readonly string[] = ["text", "textarea", "number"];
const PLACEHOLDER_TYPES: readonly string[] = ["text", "number", "email", "textarea", "dropdown"];

const fieldSchema = z
  .object({
    label: z.preprocess(
      tidy,
      z
        .string({ error: "validation.required" })
        .min(1, { error: "validation.required" })
        .max(FIELD_LABEL_MAX, { error: "validation.invalid" }),
    ),
    key: z
      .string({ error: "validation.required" })
      .trim()
      .regex(/^[a-z][a-z0-9_]{0,39}$/, { error: "validation.fieldKeyInvalid" }),
    type: z.enum(FIELD_TYPES, { error: "validation.invalid" }),
    placeholder: clearable(z.preprocess(tidy, z.string().max(PLACEHOLDER_MAX))),
    options: z
      .array(
        z.preprocess(
          tidy,
          z
            .string()
            .min(1, { error: "validation.required" })
            .max(OPTION_MAX, { error: "validation.invalid" }),
        ),
      )
      .max(OPTIONS_MAX, { error: "validation.invalid" })
      .nullish(),
    min: z.number({ error: "validation.numberInvalid" }).finite().nullish(),
    max: z.number({ error: "validation.numberInvalid" }).finite().nullish(),
    required: z.boolean({ error: "validation.invalid" }).nullish(),
  })
  .superRefine((field, problems) => {
    const options = field.options ?? [];
    if ((field.type === "dropdown" || field.type === "radio") && options.length === 0) {
      problems.addIssue({
        code: "custom",
        path: ["options"],
        message: "validation.optionsRequired",
      });
    }
    const lowered = options.map((option) => option.toLowerCase());
    if (new Set(lowered).size !== lowered.length) {
      problems.addIssue({
        code: "custom",
        path: ["options"],
        message: "validation.optionsDuplicate",
      });
    }
    if (
      LENGTH_TYPES.includes(field.type) &&
      typeof field.min === "number" &&
      typeof field.max === "number" &&
      field.min > field.max
    ) {
      problems.addIssue({ code: "custom", path: ["max"], message: "validation.rangeOrder" });
    }
  })
  // What a kind of field does not use is not kept, so the stored list only holds what the pages draw.
  .transform((field) => {
    const kept: {
      label: string;
      key: string;
      type: (typeof FIELD_TYPES)[number];
      required: boolean;
      placeholder?: string;
      options?: string[];
      min?: number;
      max?: number;
    } = { label: field.label, key: field.key, type: field.type, required: field.required ?? false };
    if (PLACEHOLDER_TYPES.includes(field.type) && field.placeholder) {
      kept.placeholder = field.placeholder;
    }
    if (CHOICE_TYPES.includes(field.type) && field.options && field.options.length > 0) {
      kept.options = field.options;
    }
    if (LENGTH_TYPES.includes(field.type)) {
      if (typeof field.min === "number") kept.min = field.min;
      if (typeof field.max === "number") kept.max = field.max;
    }
    return kept;
  });

const slug = z
  .string({ error: "validation.slugInvalid" })
  .trim()
  .min(2, { error: "validation.slugInvalid" })
  .max(80, { error: "validation.slugInvalid" })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "validation.slugInvalid" });

const details = {
  name: z.preprocess(
    tidy,
    z
      .string({ error: "validation.required" })
      .min(2, { error: "validation.required" })
      .max(FORM_NAME_MAX, { error: "validation.invalid" }),
  ),
  slug,
  kind: z.enum(FORM_KINDS, { error: "validation.invalid" }),
  placement: z.enum(FORM_PLACEMENTS, { error: "validation.invalid" }),
  projectId: z.preprocess((typed) => (typed === "" ? null : typed), uuid.nullable()).optional(),
  crmIntegrationId: z
    .preprocess((typed) => (typed === "" ? null : typed), uuid.nullable())
    .optional(),
  buttonText: clearable(z.preprocess(tidy, z.string().max(BUTTON_TEXT_MAX))),
  successMessage: clearable(z.preprocess(tidy, z.string().max(SUCCESS_MESSAGE_MAX))),
  fields: z
    .array(fieldSchema)
    .min(1, { error: "validation.fieldsRequired" })
    .max(FIELD_COUNT_MAX, { error: "validation.invalid" }),
  active: z.boolean({ error: "validation.invalid" }).default(true),
};

/** The rules that look at more than one box; each message goes on the box that has to change. */
function crossRules(
  value: {
    placement: (typeof FORM_PLACEMENTS)[number];
    projectId?: string | null | undefined;
    fields: { key: string }[];
  },
  problems: z.RefinementCtx,
): void {
  if (value.placement === "project_specific" && !value.projectId) {
    problems.addIssue({
      code: "custom",
      path: ["projectId"],
      message: "validation.projectRequired",
    });
  }
  const seen = new Set<string>();
  value.fields.forEach((field, index) => {
    if (seen.has(field.key)) {
      problems.addIssue({
        code: "custom",
        path: ["fields", index, "key"],
        message: "validation.fieldKeyTaken",
      });
    }
    seen.add(field.key);
  });
}

/** A new form. */
export const createFormSchema = z.object(details).superRefine(crossRules);
export type CreateFormInput = z.infer<typeof createFormSchema>;

/** Changes to a form that exists. */
export const updateFormSchema = z.object({ formId: uuid, ...details }).superRefine(crossRules);
export type UpdateFormInput = z.infer<typeof updateFormSchema>;

export const setFormActiveSchema = z.object({
  formId: uuid,
  active: z.boolean({ error: "validation.invalid" }),
});
export type SetFormActiveInput = z.infer<typeof setFormActiveSchema>;

export const duplicateFormSchema = z.object({ formId: uuid });
export type DuplicateFormInput = z.infer<typeof duplicateFormSchema>;

export const deleteFormSchema = z.object({ formId: uuid });
export type DeleteFormInput = z.infer<typeof deleteFormSchema>;
