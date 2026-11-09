import type { FormFieldBox, FormFieldDraft } from "@/components/domain/form-fields-editor";
import type {
  FormSettingsField,
  FormSettingsValues,
} from "@/components/domain/form-settings-fields";
import { FIELD_TYPES, type FieldType, type FormField } from "@/features/forms";
import type { AdminFormView } from "./view";

/**
 * The editor's values as typed, and how they become what the save action takes (S7-T08, FR-ADM-08). Pure: no screen,
 * no network. The boxes hold text; the schema (`schemas.ts`) is the one that decides what is allowed, and this file
 * only shapes the text into the schema's input and puts the schema's problems back on the boxes that have them.
 */

/** The kinds of field that offer choices, and the ones that have a smallest and largest (the same as the editor's). */
const CHOICE_TYPES: readonly string[] = ["dropdown", "radio", "checkbox"];
const LENGTH_TYPES: readonly string[] = ["text", "textarea", "number"];

/** The quick-add chips: what each one adds (the label's words come from the page). */
export const QUICK_ADD_IDS = ["name", "mobile", "email", "city", "budget", "bhk"] as const;
export type QuickAddId = (typeof QUICK_ADD_IDS)[number];

type Preset = Pick<FormFieldDraft, "key" | "type" | "required" | "options">;
const PRESETS: Record<QuickAddId, Preset> = {
  name: { key: "name", type: "text", required: true, options: "" },
  mobile: { key: "mobile", type: "text", required: true, options: "" },
  email: { key: "email", type: "email", required: false, options: "" },
  city: { key: "city", type: "text", required: false, options: "" },
  budget: { key: "budget", type: "number", required: false, options: "" },
  bhk: { key: "bhk", type: "dropdown", required: false, options: "1 BHK\n2 BHK\n3 BHK\n4 BHK" },
};

/** A new box for a field: no label yet, text. */
export function blankDraft(id: string): FormFieldDraft {
  return {
    id,
    label: "",
    key: "",
    type: "text",
    placeholder: "",
    options: "",
    min: "",
    max: "",
    required: false,
  };
}

/** The field a quick-add chip makes; `label` is the chip's own word. */
export function presetDraft(id: string, preset: QuickAddId, label: string): FormFieldDraft {
  return { ...blankDraft(id), ...PRESETS[preset], label };
}

/** A stored field as boxes: choices one on each line, limits as text. */
export function draftOfField(field: FormField, id: string): FormFieldDraft {
  return {
    id,
    label: field.label,
    key: field.key,
    type: field.type,
    placeholder: field.placeholder ?? "",
    options: (field.options ?? []).join("\n"),
    min: typeof field.min === "number" ? String(field.min) : "",
    max: typeof field.max === "number" ? String(field.max) : "",
    required: field.required ?? false,
  };
}

/** The Settings boxes: what the form holds, or sensible starts for a new one (an enquiry form, shown nowhere, on). */
export function settingsOfForm(form: AdminFormView | null): FormSettingsValues {
  if (!form) {
    return {
      name: "",
      slug: "",
      kind: "enquiry",
      placement: "none",
      projectId: "",
      crmIntegrationId: "",
      buttonText: "",
      successMessage: "",
      active: true,
    };
  }
  return {
    name: form.name,
    slug: form.slug,
    kind: form.kind,
    placement: form.placement,
    projectId: form.projectId ?? "",
    crmIntegrationId: form.crmIntegrationId ?? "",
    buttonText: form.buttonText ?? "",
    successMessage: form.successMessage ?? "",
    active: form.active,
  };
}

/** A key a label suggests: lower case, words joined by underscores, starting with a letter, at most 40 characters. */
export function keyFromLabel(label: string): string {
  const words = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const lettered = /^[a-z]/.test(words) ? words : words === "" ? "" : `f_${words}`;
  return lettered.slice(0, 40).replace(/_+$/, "");
}

/** A slug a name suggests: lower case words joined by hyphens, at most 80 characters. */
export function slugFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

/** The numbers a box holds: a blank box is no limit; text that is not a number goes on as it is so the schema says so. */
function limitOf(text: string): number | null | string {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : trimmed;
}

/** What the save action takes. Boxes a kind of field does not use are left out, so they can never be a problem. */
export function payloadOf(settings: FormSettingsValues, drafts: readonly FormFieldDraft[]) {
  return {
    name: settings.name,
    slug: settings.slug,
    kind: settings.kind,
    placement: settings.placement,
    projectId: settings.placement === "project_specific" ? settings.projectId : "",
    crmIntegrationId: settings.crmIntegrationId,
    buttonText: settings.buttonText,
    successMessage: settings.successMessage,
    active: settings.active,
    fields: drafts.map((draft) => ({
      label: draft.label,
      key: draft.key,
      type: draft.type,
      required: draft.required,
      placeholder: draft.placeholder,
      ...(CHOICE_TYPES.includes(draft.type)
        ? {
            options: draft.options
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line !== ""),
          }
        : {}),
      ...(LENGTH_TYPES.includes(draft.type)
        ? { min: limitOf(draft.min), max: limitOf(draft.max) }
        : {}),
    })),
  };
}

/** The problems of one save, put where they belong. */
export type EditorProblems = {
  /** On the Settings boxes. */
  settings: Partial<Record<FormSettingsField, string>>;
  /** On the boxes of each field, by the field's id. */
  fields: Record<string, Partial<Record<FormFieldBox, string>>>;
  /** About the form as a whole (no fields at all, too many), or a box that is not on the screen. */
  form: string[];
};

export const NO_PROBLEMS: EditorProblems = { settings: {}, fields: {}, form: [] };

const SETTINGS_BOXES: readonly string[] = [
  "name",
  "slug",
  "kind",
  "placement",
  "projectId",
  "crmIntegrationId",
  "buttonText",
  "successMessage",
];
const FIELD_BOXES: readonly string[] = [
  "label",
  "key",
  "type",
  "placeholder",
  "options",
  "min",
  "max",
];

/**
 * Puts the server's problems (by path: `slug`, `fields.2.key`, `fields.1.options.0`, `fields`) on the boxes. A path
 * names a field by its place in the list; `drafts` says which box that is now. The first problem of a box wins.
 * Anything with no box to blame goes to `form`.
 */
export function problemsOf(
  byPath: Readonly<Record<string, string>>,
  drafts: readonly FormFieldDraft[],
): EditorProblems {
  const result: EditorProblems = { settings: {}, fields: {}, form: [] };
  for (const [path, message] of Object.entries(byPath)) {
    const parts = path.split(".");
    const [head, index, box] = parts;
    if (head === "fields" && index !== undefined) {
      const draft = drafts[Number(index)];
      const target = box !== undefined && FIELD_BOXES.includes(box) ? (box as FormFieldBox) : null;
      if (draft && target) {
        const own = result.fields[draft.id] ?? {};
        if (own[target] === undefined) own[target] = message;
        result.fields[draft.id] = own;
        continue;
      }
      result.form.push(message);
      continue;
    }
    if (head !== undefined && parts.length === 1 && SETTINGS_BOXES.includes(head)) {
      const name = head as FormSettingsField;
      if (result.settings[name] === undefined) result.settings[name] = message;
      continue;
    }
    result.form.push(message);
  }
  return result;
}

/** How many boxes (and form-wide notes) have a problem. */
export function countProblems(problems: EditorProblems): number {
  return (
    Object.keys(problems.settings).length +
    Object.values(problems.fields).reduce((sum, boxes) => sum + Object.keys(boxes).length, 0) +
    problems.form.length
  );
}

/** The id of the first field that has a problem, to open its row. */
export function firstFieldWithProblem(
  problems: EditorProblems,
  drafts: readonly FormFieldDraft[],
): string | null {
  return drafts.find((draft) => problems.fields[draft.id] !== undefined)?.id ?? null;
}

/**
 * The keys used twice: the second and later fields with a key get the problem, saying which key. Checked before
 * sending so the admin sees it at once; the server checks the same rule.
 */
export function duplicateKeyProblems(
  drafts: readonly FormFieldDraft[],
  say: (key: string) => string,
): Record<string, Partial<Record<FormFieldBox, string>>> {
  const seen = new Set<string>();
  const found: Record<string, Partial<Record<FormFieldBox, string>>> = {};
  for (const draft of drafts) {
    const key = draft.key.trim();
    if (key === "") continue;
    if (seen.has(key)) found[draft.id] = { key: say(key) };
    seen.add(key);
  }
  return found;
}

const isFieldType = (value: string): value is FieldType =>
  (FIELD_TYPES as readonly string[]).includes(value);

/**
 * The fields as the live preview draws them: the ones that already have a label, in order. A field with no key yet
 * is drawn under its box's id, and a limit that is not a number is left out.
 */
export function previewFieldsOf(drafts: readonly FormFieldDraft[]): FormField[] {
  return drafts.flatMap((draft) => {
    const label = draft.label.trim();
    if (label === "" || !isFieldType(draft.type)) return [];
    const options = CHOICE_TYPES.includes(draft.type)
      ? draft.options
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line !== "")
      : [];
    const min = Number(draft.min);
    const max = Number(draft.max);
    return [
      {
        label,
        key: draft.key.trim() || draft.id,
        type: draft.type,
        placeholder: draft.placeholder.trim() || undefined,
        options: options.length > 0 ? options : undefined,
        min:
          LENGTH_TYPES.includes(draft.type) && draft.min.trim() !== "" && Number.isFinite(min)
            ? min
            : undefined,
        max:
          LENGTH_TYPES.includes(draft.type) && draft.max.trim() !== "" && Number.isFinite(max)
            ? max
            : undefined,
        required: draft.required,
      },
    ];
  });
}

/** A key not used by another field yet: the base, then `base_2`, `base_3` ... (cut to the key limit). */
export function freeKey(base: string, drafts: readonly FormFieldDraft[]): string {
  const taken = new Set(drafts.map((draft) => draft.key.trim()));
  if (!taken.has(base)) return base;
  for (let attempt = 2; attempt < 100; attempt += 1) {
    const suffix = `_${attempt}`;
    const candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

/** A copy of a record without one key. */
export function without<Box extends string>(
  record: Partial<Record<Box, string>>,
  key: string,
): Partial<Record<Box, string>> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key)) as Partial<
    Record<Box, string>
  >;
}
