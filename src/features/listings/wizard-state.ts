import { toFieldErrors } from "@/server/actions/field-errors";
import type { FieldError } from "@/types/action";
import type {
  ListingLocationHeld,
  LocationArea,
  PlaceAutocompleteSuggestion,
} from "@/types/places";
import {
  ADDRESS_MAX,
  CITY_MAX,
  LOCALITY_MAX,
  STATE_NAME,
  TYPES_WITHOUT_BEDROOMS,
  type PropertyType,
} from "./constants";
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
  /**
   * The place the owner picked (place search PR 7b, ADR-141): latitude and longitude as text, with whether it is the
   * exact spot or the middle of an area, and the name shown on the "Location found" card. Empty until a place is
   * picked. They live with the other boxes so a failed save and the answers kept before signing in again carry
   * them, but they are never part of the draft's fields (`draftInput`): the point goes to its own action.
   */
  locationLat: string;
  locationLng: string;
  locationKind: "" | "exact" | "approximate";
  locationLabel: string;
  locationDetail: string;
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
  locationLat: "",
  locationLng: "",
  locationKind: "",
  locationLabel: "",
  locationDetail: "",
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
  // The place is asked on the address step, though it is not one of the draft's boxes.
  if (field === "location") return 1;
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
    // The stored point is private and never read here (ADR-141): an opened draft knows only that one is held.
    locationLat: "",
    locationLng: "",
    locationKind: "",
    locationLabel: "",
    locationDetail: "",
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

/** The place held in the boxes as a point, or null when none is held or the text is not a pair of numbers. */
export function pointOf(values: WizardValues): { lat: number; lng: number } | null {
  if (values.locationLat.trim() === "" || values.locationLng.trim() === "") return null;
  const lat = Number(values.locationLat);
  const lng = Number(values.locationLng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** A short key for a point, to tell whether the one held is the one already written. Never shown or logged. */
export function pointKey(values: WizardValues): string | null {
  const point = pointOf(values);
  return point ? `${point.lat},${point.lng}` : null;
}

/** What the "Location found" card shows for the place picked in this sitting, or null when none is held. */
export function pickedPlace(values: WizardValues): ListingLocationHeld | null {
  if (pointOf(values) === null) return null;
  return {
    label: values.locationLabel,
    ...(values.locationDetail === "" ? {} : { detail: values.locationDetail }),
    approximate: values.locationKind === "approximate",
  };
}

/** Takes the place off the boxes (Change was pressed). The address, locality, city and pincode stay as they are. */
export function clearPlace(values: WizardValues): WizardValues {
  return {
    ...values,
    locationLat: "",
    locationLng: "",
    locationKind: "",
    locationLabel: "",
    locationDetail: "",
  };
}

/**
 * Continue on the address step needs a place: one picked now, or one the listing already holds (an opened draft or
 * a listing being edited, where the point itself is private and unknown here). The text of the problem is the
 * location field's own ("Add a location to continue."), so the error only says which field.
 */
export function locationProblem(values: WizardValues, held: boolean): StepErrors {
  if (pointOf(values) !== null || held) return {};
  return { location: { key: "validation.required" } };
}

const PINCODE_IN_TEXT = /(?<![0-9])[56][0-9]{5}(?![0-9])/;

/** The first part of "Chennai, Tamil Nadu, India" that names a city: not the state, the country or a number. */
function cityOf(detail: string): string | null {
  const state = STATE_NAME.toLowerCase();
  for (const part of detail.split(",")) {
    const name = part.trim();
    const lower = name.toLowerCase();
    if (name === "" || lower.startsWith(state) || lower === "india" || /^[0-9 ]+$/.test(name)) {
      continue;
    }
    return name;
  }
  return null;
}

/** The first six-digit number of a Tamil Nadu address (a pincode starts with 5 or 6) in the text, or null. */
function pincodeOf(detail: string): string | null {
  return PINCODE_IN_TEXT.exec(detail)?.[0] ?? null;
}

const isBlank = (value: string) => value.trim() === "";

/** What choosing a place does to the boxes. */
export interface PickOptions {
  /** The place is the middle of an area: the listing will show as approximate. */
  approximate: boolean;
  /**
   * The City box still holds the starting value the wizard gave it and nobody has typed in it, so it counts as
   * empty (the box starts as "Chennai"; it is not the owner's answer). Anything else in the box is left alone.
   */
  cityUntouched?: boolean;
}

/**
 * A place chosen from the suggestions (or from the area chooser's own suggestions). Keeps the point, and fills a
 * box only while it is EMPTY, never over what the owner typed: the address with the name and the rest of the
 * address, the locality with the name when the place is an area, the city with the first part of the address
 * that is not the state, and the pincode with the first six-digit number in it that starts with 5 or 6.
 */
export function applySuggestion(
  values: WizardValues,
  suggestion: PlaceAutocompleteSuggestion,
  options: PickOptions,
): WizardValues {
  const next: WizardValues = {
    ...values,
    locationLat: String(suggestion.lat),
    locationLng: String(suggestion.lng),
    locationKind: options.approximate ? "approximate" : "exact",
    locationLabel: suggestion.label,
    locationDetail: suggestion.detail,
  };
  if (isBlank(values.address)) {
    const full = [suggestion.label, suggestion.detail].filter((part) => !isBlank(part)).join(", ");
    next.address = full.slice(0, ADDRESS_MAX).trim();
  }
  if (isBlank(values.locality) && suggestion.kind === "area") {
    next.locality = suggestion.label.slice(0, LOCALITY_MAX).trim();
  }
  if (isBlank(values.city) || options.cityUntouched === true) {
    const city = cityOf(suggestion.detail);
    if (city !== null) next.city = city.slice(0, CITY_MAX);
  }
  if (isBlank(values.pincode)) {
    const pincode = pincodeOf(suggestion.detail);
    if (pincode !== null) next.pincode = pincode;
  }
  return next;
}

/**
 * An area chosen from the site's curated localities, the way to place a listing when suggestions cannot be
 * fetched (so posting never stops). The point is the middle of the area and shows as approximate. The locality
 * is filled with the area's name while it is empty; the address, city and pincode are the owner's.
 */
export function applyArea(values: WizardValues, area: LocationArea): WizardValues {
  const next: WizardValues = {
    ...values,
    locationLat: String(area.lat),
    locationLng: String(area.lng),
    locationKind: "approximate",
    locationLabel: area.label,
    locationDetail: area.detail ?? "",
  };
  if (isBlank(values.locality)) next.locality = area.label.slice(0, LOCALITY_MAX).trim();
  return next;
}
