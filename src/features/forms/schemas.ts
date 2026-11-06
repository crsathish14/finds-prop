import { z } from "zod";

/** The nine kinds of field a form can have (FR-ADM-08). */
export const FIELD_TYPES = [
  "text",
  "number",
  "email",
  "dropdown",
  "radio",
  "checkbox",
  "textarea",
  "date",
  "file",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** A stored value may be missing or null; both mean "not given". */
const optional = <Schema extends z.ZodType>(schema: Schema) =>
  schema.nullish().transform((value) => value ?? undefined);

/**
 * One field of a stored form, as the form builder saves it (`forms.fields`): the question, the key its
 * answer is stored under, the kind, and the limits that kind uses. The database keeps the list as a
 * bounded array; this is where its shape is checked (BR-60).
 */
export const formFieldSchema = z.object({
  label: z.string().trim().min(1).max(120),
  /** The key the answer is stored under. `name`, `mobile` and `email` also fill the submission's own columns. */
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  type: z.enum(FIELD_TYPES),
  placeholder: optional(z.string().max(120)),
  /** The choices of a dropdown, a radio group or a group of checkboxes. */
  options: optional(z.array(z.string().trim().min(1).max(80)).min(1).max(40)),
  /** A text's shortest and longest length, or a number's smallest and largest value. */
  min: optional(z.number()),
  max: optional(z.number()),
  required: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
});

export type FormField = z.infer<typeof formFieldSchema>;

export const formFieldsSchema = z.array(formFieldSchema).max(30);

/** The kinds of form the builder offers (`forms.kind`) and where each is shown (`forms.placement`). */
export const FORM_KINDS = [
  "enquiry",
  "site_visit",
  "brochure",
  "callback",
  "contact",
  "whatsapp",
] as const;
export const FORM_PLACEMENTS = ["none", "project", "project_specific", "contact"] as const;

/** A form as the page and the action hold it: only what a visitor may see (no CRM link). */
export type FormDefinition = {
  slug: string;
  name: string;
  kind: (typeof FORM_KINDS)[number];
  placement: (typeof FORM_PLACEMENTS)[number];
  projectId: string | null;
  buttonText: string | null;
  successMessage: string | null;
  fields: FormField[];
};

const slugField = z
  .string({ error: "validation.invalid" })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "validation.invalid" })
  .min(2, { error: "validation.invalid" })
  .max(80, { error: "validation.invalid" });

/** What the browser sends: the answers by field key, and nothing that says who is sending. */
export const submitFormSchema = z.object({
  formSlug: slugField,
  /** The answers by field key. A key the form does not have is dropped by the server. */
  values: z
    .record(
      z.string().max(40),
      z.union([
        z.string().max(5000),
        z.number(),
        z.boolean(),
        z.array(z.string().max(200)).max(40),
      ]),
    )
    .refine((values) => Object.keys(values).length <= 40, { error: "validation.invalid" }),
  /** The page the form was filled in on (an address on this site), kept with the submission. */
  source: z
    .string()
    .max(200)
    .regex(/^\/[A-Za-z0-9/_.-]*$/, { error: "validation.invalid" })
    .optional(),
  /** For a form shown on every project page: the project page it was filled in on. */
  projectSlug: slugField.optional(),
  /** One per form, made in the browser, so a double click or a retry stores one submission. */
  idempotencyKey: z.uuid({ error: "validation.invalid" }),
});

export type SubmitFormInput = z.infer<typeof submitFormSchema>;
