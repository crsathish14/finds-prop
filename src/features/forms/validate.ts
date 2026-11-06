import type { FieldError } from "@/types/action";
import type { FormField } from "./schemas";

/** The limits a field type uses when the form gives none. */
export const DEFAULT_TEXT_MAX = 200;
export const DEFAULT_TEXTAREA_MAX = 2000;
const EMAIL_MAX = 254;
/** The answers of one submission may not weigh more than this once stored as text. */
export const DATA_MAX_BYTES = 10_000;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PHONE = /^[0-9]{6,15}$/;
const CONTROL = /[\p{C}]/u;

export type AnswerValue = string | number | boolean | string[];

/** What a valid submission becomes: the three columns of its own and everything else as data. */
export type ValidSubmission = {
  name: string | null;
  mobile: string | null;
  email: string | null;
  data: Record<string, AnswerValue>;
};

export type SubmissionResult =
  | { ok: true; submission: ValidSubmission }
  | { ok: false; fieldErrors: Record<string, FieldError[]> };

type Checked = { value: AnswerValue } | { empty: true } | { error: FieldError };

const empty = (): Checked => ({ empty: true });
const problem = (key: string, values?: Record<string, number>): Checked => ({
  error: values ? { key, values } : { key },
});

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

function asText(value: unknown): string | null {
  return typeof value === "string"
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : null;
}

function checkText(field: FormField, value: unknown, fallbackMax: number): Checked {
  const text = asText(value);
  if (text === null || CONTROL.test(text.replace(/[\n\r\t]/g, "")))
    return problem("validation.invalid");
  const max = field.max ?? fallbackMax;
  const min = field.min ?? 0;
  if (text.length < min) return problem("validation.tooShort", { minimum: min });
  if (text.length > max) return problem("validation.tooLong", { maximum: max });
  return { value: text.replace(/\r\n/g, "\n") };
}

function checkNumber(field: FormField, value: unknown): Checked {
  const text = asText(value);
  if (text === null || text === "" || !Number.isFinite(Number(text)))
    return problem("validation.invalid");
  const number = Number(text);
  if (field.min !== undefined && number < field.min)
    return problem("validation.tooSmall", { minimum: field.min });
  if (field.max !== undefined && number > field.max)
    return problem("validation.tooBig", { maximum: field.max });
  return { value: number };
}

function checkDay(value: unknown): Checked {
  const text = asText(value);
  if (text === null || !DAY.test(text)) return problem("validation.invalid");
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    return problem("validation.invalid");
  }
  return { value: text };
}

function checkChoice(field: FormField, value: unknown): Checked {
  const text = asText(value);
  return text !== null && (field.options ?? []).includes(text)
    ? { value: text }
    : problem("validation.invalid");
}

function checkCheckbox(field: FormField, value: unknown): Checked {
  if (field.options) {
    const picked = Array.isArray(value) ? value : [value];
    const allowed = field.options;
    return picked.every((item) => typeof item === "string" && allowed.includes(item))
      ? { value: picked as string[] }
      : problem("validation.invalid");
  }
  if (value === true || value === "true" || value === "on") return { value: true };
  if (value === false || value === "false" || value === "off") {
    // A required box with no choices is an agreement: it has to be ticked.
    return field.required ? problem("validation.required") : { value: false };
  }
  return problem("validation.invalid");
}

function checkField(field: FormField, value: unknown): Checked {
  const blankCheckbox = field.type === "checkbox" && !field.options && value === false;
  if (isBlank(value) || (blankCheckbox && !field.required)) {
    return field.required ? problem("validation.required") : empty();
  }
  // Files arrive with the upload step (S5-T05, change 3); until then a file field takes no answer.
  if (field.type === "file") return field.required ? problem("validation.required") : empty();

  // The three columns of their own take a plain kind of answer whatever the field's type says.
  if (field.key === "mobile") {
    const digits = (asText(value) ?? "").replace(/[\s\-()]/g, "").replace(/^\+/, "");
    return PHONE.test(digits) ? { value: digits } : problem("validation.phoneInvalid");
  }
  if (field.key === "email" || field.type === "email") {
    const text = (asText(value) ?? "").toLowerCase();
    return EMAIL.test(text) && text.length <= EMAIL_MAX
      ? { value: text }
      : problem("validation.emailInvalid");
  }
  switch (field.type) {
    case "text":
      return checkText(field, value, DEFAULT_TEXT_MAX);
    case "textarea":
      return checkText(field, value, DEFAULT_TEXTAREA_MAX);
    case "number":
      return checkNumber(field, value);
    case "date":
      return checkDay(value);
    case "dropdown":
    case "radio":
      return checkChoice(field, value);
    case "checkbox":
      return checkCheckbox(field, value);
    default:
      return problem("validation.invalid");
  }
}

/**
 * Checks a visitor's answers against the stored definition of the form (BR-60), field by field, and
 * says which fields are wrong with the keys the screens turn into words. Only the form's own fields
 * count: an answer for a key the form does not have is dropped, so a request cannot add data the form
 * never asked for. An empty answer to an optional field is left out. `name`, `mobile` and `email` fill
 * the submission's own columns (the mobile as digits, the email in lower case); everything else is data.
 */
export function validateSubmission(
  fields: readonly FormField[],
  values: Readonly<Record<string, unknown>>,
): SubmissionResult {
  const fieldErrors: Record<string, FieldError[]> = {};
  const data: Record<string, AnswerValue> = {};
  const submission: ValidSubmission = { name: null, mobile: null, email: null, data };

  for (const field of fields) {
    const checked = checkField(field, values[field.key]);
    if ("error" in checked) {
      fieldErrors[field.key] = [checked.error];
    } else if ("value" in checked) {
      if (field.key === "name" && typeof checked.value === "string")
        submission.name = checked.value;
      else if (field.key === "mobile" && typeof checked.value === "string")
        submission.mobile = checked.value;
      else if (field.key === "email" && typeof checked.value === "string")
        submission.email = checked.value;
      else data[field.key] = checked.value;
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  if (JSON.stringify(data).length > DATA_MAX_BYTES) {
    return {
      ok: false,
      fieldErrors: { _form: [{ key: "validation.tooLong", values: { maximum: DATA_MAX_BYTES } }] },
    };
  }
  return { ok: true, submission };
}
