import { toFieldErrors } from "@/server/actions/field-errors";
import type { FieldError } from "@/types/action";
import { TYPES_WITHOUT_BEDROOMS, type PropertyType } from "./constants";
import {
  basicsStepSchema,
  descriptionStepSchema,
  detailsStepSchema,
  draftFieldsSchema,
  type DraftFields,
} from "./schemas";
import type { DraftView } from "./view";

/**
 * The wizard's state without React (S6-T02, FR-ACC-06): what the boxes hold, which fields belong to which
 * step, what a step's check says, and what to send. The boxes hold text, so every value here is a string (or
 * the list of amenities); the schemas in `schemas.ts` turn them into numbers. A draft that is opened again
 * fills the boxes from what it saved. Nothing here reaches the server or the browser.
 */
export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardValues {
  listingType: string;
  propertyType: string;
  address: string;
  locality: string;
  city: string;
  pincode: string;
  bhk: string;
  bathrooms: string;
  areaSqft: string;
  price: string;
  furnishing: string;
  amenities: string[];
  title: string;
  description: string;
}

export type WizardField = keyof WizardValues;

/** The state is fixed (Tamil Nadu only for now), so the box is read-only and never sent. */
export const EMPTY_VALUES: WizardValues = {
  listingType: "sale",
  propertyType: "apartment",
  address: "",
  locality: "",
  city: "Chennai",
  pincode: "",
  bhk: "",
  bathrooms: "",
  areaSqft: "",
  price: "",
  furnishing: "",
  amenities: [],
  title: "",
  description: "",
};

/** The fields each step asks for, so an error lands on the right step. Step 3 (photos) has none. */
export const STEP_FIELDS: Record<WizardStep, readonly WizardField[]> = {
  1: ["listingType", "propertyType", "address", "locality", "city", "pincode"],
  2: ["bhk", "bathrooms", "areaSqft", "price", "furnishing", "amenities"],
  3: [],
  4: ["title", "description"],
  5: [],
};

/** The step a field is asked on; a field that is not a box (photos, the limit) is on the step it names. */
export function stepOfField(field: string): WizardStep | null {
  for (const step of [1, 2, 4] as const) {
    if ((STEP_FIELDS[step] as readonly string[]).includes(field)) return step;
  }
  if (field === "photos") return 3;
  return null;
}

const text = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? "" : String(value);

/** The boxes as an opened draft left them; a new listing starts from the defaults. */
export function valuesFromDraft(draft: DraftView): WizardValues {
  return {
    listingType: draft.listingType ?? EMPTY_VALUES.listingType,
    propertyType: draft.propertyType ?? EMPTY_VALUES.propertyType,
    address: text(draft.address),
    locality: text(draft.locality),
    city: draft.city ?? EMPTY_VALUES.city,
    pincode: text(draft.pincode),
    bhk: text(draft.bhk),
    bathrooms: text(draft.bathrooms),
    areaSqft: text(draft.areaSqft),
    price: text(draft.price),
    furnishing: text(draft.furnishing),
    amenities: [...draft.amenities],
    title: text(draft.title),
    description: text(draft.description),
  };
}

/** Whether a property type has bedrooms: land and commercial space do not. */
export function hasBedrooms(propertyType: string): boolean {
  return !TYPES_WITHOUT_BEDROOMS.includes(propertyType as PropertyType);
}

function pick(values: WizardValues, fields: readonly WizardField[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of fields) picked[field] = values[field];
  return picked;
}

/** A box left empty is a field not given, for the fields a listing may do without. */
function leaveOutBlank(
  input: Record<string, unknown>,
  optional: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([key, value]) =>
        !(optional.includes(key) && typeof value === "string" && value.trim() === ""),
    ),
  );
}

export type StepErrors = Partial<Record<string, FieldError>>;

/** The first message of each field the schema refused. */
function firstErrors(error: Parameters<typeof toFieldErrors>[0], data: unknown): StepErrors {
  const found: StepErrors = {};
  for (const [field, list] of Object.entries(toFieldErrors(error, data))) {
    const first = list[0];
    if (first) found[field] = first;
  }
  return found;
}

/**
 * Continue checks only the current step (the schemas of `schemas.ts`, the same rules the server applies).
 * Returns the problems by field, or an empty object when the step is fine. Step 3 is checked by the page
 * (it counts the photos) and step 5 has no boxes.
 */
export function validateStep(step: WizardStep, values: WizardValues): StepErrors {
  if (step === 1) {
    const input = pick(values, STEP_FIELDS[1]);
    const result = basicsStepSchema.safeParse(input);
    return result.success ? {} : firstErrors(result.error, input);
  }
  if (step === 2) {
    const fields = STEP_FIELDS[2].filter(
      (field) => field !== "bhk" || hasBedrooms(values.propertyType),
    );
    const input = leaveOutBlank(pick(values, fields), ["bhk", "bathrooms", "furnishing"]);
    const result = detailsStepSchema.safeParse(input);
    return result.success ? {} : firstErrors(result.error, input);
  }
  if (step === 4) {
    const input = leaveOutBlank(pick(values, STEP_FIELDS[4]), ["description"]);
    const result = descriptionStepSchema.safeParse(input);
    return result.success ? {} : firstErrors(result.error, input);
  }
  return {};
}

/**
 * What "Save draft" and every Continue send: the fields of the steps up to the one asked for, as the draft
 * schema takes them (an empty box clears its field). Bedrooms are left out for land and commercial space.
 */
export function draftInput(
  values: WizardValues,
  steps: readonly WizardStep[],
): Record<string, unknown> {
  const input: Record<string, unknown> = {};
  for (const step of steps) {
    for (const field of STEP_FIELDS[step]) {
      if (field === "bhk" && !hasBedrooms(values.propertyType)) continue;
      input[field] = values[field];
    }
  }
  return input;
}

/** Checks a draft's fields the way the server will, so "Save draft" can show a field that is wrong. */
export function checkDraft(input: Record<string, unknown>): StepErrors {
  const result = draftFieldsSchema.safeParse(input);
  return result.success ? {} : firstErrors(result.error, input);
}

export type { DraftFields };

/** The steps a set of errors falls on, in order. */
export function stepsWithErrors(errors: StepErrors): WizardStep[] {
  const steps = new Set<WizardStep>();
  for (const field of Object.keys(errors)) {
    const step = stepOfField(field);
    if (step) steps.add(step);
  }
  return [...steps].sort((first, second) => first - second);
}
