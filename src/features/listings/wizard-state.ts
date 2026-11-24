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
  contactEmailSchema,
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
  /**
   * The email enquiries are mailed to (ADR-186): asked on the last step of a new listing, started from the one the
   * account already holds. It belongs to the account, not the listing, so it is never part of the draft's fields
   * (`draftInput`) and is not kept in the browser for the way back in.
   */
  contactEmail: string;
}

export type WizardField = keyof WizardValues;

/** The state is fixed (Tamil Nadu only for now), so the box is read-only and never sent. */
export const EMPTY_VALUES: WizardValues = {
  listingType: "sale",
  propertyType: "apartment",
  address: "",
  locality: "",
  city: "",
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
  contactEmail: "",
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
  // The email for enquiries is asked on the review step, next to Submit.
  if (field === "contactEmail") return 5;
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
    city: text(draft.city),
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
    // The account's own address comes from the page, not from the listing.
    contactEmail: "",
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

/**
 * The email for enquiries, checked the way the server will before Submit (ADR-186). Returns the problem on that field
 * (empty, or not shaped like an address), or nothing when it is fine. With a confirmed account email the box may be
 * left empty (ADR-198): the mail goes to that address; what is typed is still checked.
 */
export function validateContactEmail(values: WizardValues, optional = false): StepErrors {
  if (optional && values.contactEmail.trim() === "") return {};
  const input = { contactEmail: values.contactEmail };
  const result = contactEmailSchema.safeParse(input);
  return result.success ? {} : firstErrors(result.error, input);
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

/**
 * Takes the place off the boxes (Change was pressed). The address, locality and pincode stay as they are. The city
 * goes with the place, since the place may have given it; the wizard keeps a typed one.
 */
export function clearPlace(values: WizardValues): WizardValues {
  return {
    ...values,
    city: "",
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

/**
 * The city of a place's address ("Velachery, Chennai, Tamil Nadu 600042, India" is Chennai): the part just before
 * the state. When the state is not named, the first part that is not the country or a number.
 */
function cityOf(detail: string): string | null {
  const state = STATE_NAME.toLowerCase();
  const parts = detail.split(",").map((part) => part.trim());
  const isCity = (name: string) =>
    name !== "" &&
    !name.toLowerCase().startsWith(state) &&
    name.toLowerCase() !== "india" &&
    !/^[0-9 ]+$/.test(name);
  const stateIndex = parts.findIndex((name) => name.toLowerCase().startsWith(state));
  const before = stateIndex > 0 ? parts[stateIndex - 1] : undefined;
  if (before !== undefined && isCity(before)) return before;
  return parts.find(isCity) ?? null;
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
}

/**
 * A place chosen from the suggestions (or from the area chooser's own suggestions). Keeps the point, and sets the
 * city from the place every time (empty when the place names none; the wizard then leaves the City to be typed). Fills the other boxes only while they are EMPTY, never over what the owner typed: the
 * address with the name and the rest of the address, the locality with the name when the place is an area, and the
 * pincode with the first six-digit number in it that starts with 5 or 6.
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
  next.city = (cityOf(suggestion.detail) ?? "").slice(0, CITY_MAX);
  if (isBlank(values.pincode)) {
    const pincode = pincodeOf(suggestion.detail);
    if (pincode !== null) next.pincode = pincode;
  }
  return next;
}

/**
 * An area chosen from the site's curated localities, the way to place a listing when suggestions cannot be
 * fetched (so posting never stops). The point is the middle of the area and shows as approximate. The locality
 * is filled with the area's name while it is empty; the address and pincode are the owner's. A curated area names no
 * city, so the city is whatever the place held before (empty until a suggestion is picked).
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
