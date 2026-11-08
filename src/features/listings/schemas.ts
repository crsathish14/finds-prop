import { z } from "zod";
import {
  ADDRESS_MAX,
  AMENITY_OPTIONS,
  AREA_MAX,
  BATHROOMS_MAX,
  BHK_MAX,
  CITY_MAX,
  DESCRIPTION_MAX,
  FURNISHINGS,
  LISTING_TYPES,
  LOCALITY_MAX,
  LOCALITY_MIN,
  PRICE_MAX,
  PROPERTY_TYPES,
  TITLE_MAX,
  TITLE_MIN,
} from "./constants";

/**
 * What the post-property wizard sends (S6-T02, FR-ACC-06). Nothing here says who is posting: the owner is
 * the signed-in account, read on the server (R-BE-03). One rule per field is used twice: the step schemas
 * ask for the fields of one step (Continue checks only the current step) and the draft schema accepts any
 * of them, each checked when given, so "Save draft" keeps an unfinished listing. A schema message is a key
 * under `validation.*`; the screen looks the words up (ADR-035). Numbers may arrive as typed text.
 */

/** Typed text: surrounding spaces and doubled spaces go; the text is then checked by the rule. */
const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

/** A number typed in a box: commas and spaces are dropped; empty stays empty. */
const typedNumber = (typed: unknown): unknown => {
  if (typeof typed !== "string") return typed;
  const plain = typed.replace(/[,\s]/g, "");
  return plain === "" ? undefined : Number(plain);
};

/** No control characters in a line of text. */
const NO_CONTROL = /^[^\p{C}]*$/u;

/**
 * The message for a value of the wrong kind only (nothing given, or not text or a number). Giving a rule a
 * plain `error` would also replace the messages of its length and range checks, which carry their own
 * numbers ("at most 300 characters").
 */
const wrongKind = (missing: string) => (issue: { code: string; input?: unknown }) =>
  issue.code === "invalid_type"
    ? issue.input === undefined || issue.input === null
      ? missing
      : "validation.invalid"
    : undefined;

const listingType = z.enum(LISTING_TYPES, { error: "validation.required" });
const propertyType = z.enum(PROPERTY_TYPES, { error: "validation.required" });
const furnishing = z.enum(FURNISHINGS, { error: "validation.invalid" });

const address = z.preprocess(
  tidy,
  z
    .string({ error: wrongKind("validation.addressRequired") })
    .min(1, { error: "validation.addressRequired" })
    .max(ADDRESS_MAX)
    .regex(NO_CONTROL, { error: "validation.invalid" }),
);
const locality = z.preprocess(
  tidy,
  z
    .string({ error: wrongKind("validation.required") })
    .min(1, { error: "validation.required" })
    .min(LOCALITY_MIN)
    .max(LOCALITY_MAX)
    .regex(NO_CONTROL, { error: "validation.invalid" }),
);
const city = z.preprocess(
  tidy,
  z
    .string({ error: wrongKind("validation.required") })
    .min(1, { error: "validation.required" })
    .max(CITY_MAX)
    .regex(NO_CONTROL, { error: "validation.invalid" }),
);
const pincode = z.preprocess(
  tidy,
  z
    .string({ error: "validation.pincodeInvalid" })
    .regex(/^[1-9][0-9]{5}$/, { error: "validation.pincodeInvalid" }),
);

const bhk = z.preprocess(
  typedNumber,
  z
    .number({ error: wrongKind("validation.invalid") })
    .int({ error: "validation.invalid" })
    .min(0)
    .max(BHK_MAX),
);
const bathrooms = z.preprocess(
  typedNumber,
  z
    .number({ error: wrongKind("validation.required") })
    .int({ error: "validation.invalid" })
    .min(0)
    .max(BATHROOMS_MAX),
);
const areaSqft = z.preprocess(
  typedNumber,
  z
    .number({ error: wrongKind("validation.required") })
    .min(0)
    .max(AREA_MAX),
);
const price = z.preprocess(
  typedNumber,
  z
    .number({ error: wrongKind("validation.required") })
    .int({ error: "validation.invalid" })
    .min(0)
    .max(PRICE_MAX),
);
const amenities = z
  .array(z.enum(AMENITY_OPTIONS, { error: "validation.invalid" }), { error: "validation.invalid" })
  .refine((list) => new Set(list).size === list.length, { error: "validation.invalid" });

const title = z.preprocess(
  tidy,
  z
    .string({ error: wrongKind("validation.titleTooShort") })
    .min(TITLE_MIN, { error: "validation.titleTooShort" })
    .max(TITLE_MAX)
    .regex(NO_CONTROL, { error: "validation.invalid" }),
);
/** Free text: line breaks are kept, the ends are trimmed. */
const description = z.preprocess(
  (typed) => (typeof typed === "string" ? typed.trim() : typed),
  z.string({ error: "validation.invalid" }).max(DESCRIPTION_MAX),
);

/** The fields of each step. Step 1 and step 4 are the ones that must be there; step 2 asks for the numbers. */
export const basicsStepSchema = z.object({
  listingType,
  propertyType,
  address,
  locality,
  city,
  pincode,
});
export type BasicsStepInput = z.infer<typeof basicsStepSchema>;

export const detailsStepSchema = z.object({
  /** Not asked for land or commercial space; the page leaves it out. */
  bhk: bhk.optional(),
  bathrooms: bathrooms.optional(),
  areaSqft,
  price,
  furnishing: furnishing.optional(),
  amenities: amenities.default([]),
});
export type DetailsStepInput = z.infer<typeof detailsStepSchema>;

export const descriptionStepSchema = z.object({
  title,
  /** The approved screen calls it optional. */
  description: description.optional(),
});
export type DescriptionStepInput = z.infer<typeof descriptionStepSchema>;

/** A blank box clears the field in the draft (null); a missing field is left as it is. */
const clearable = <T extends z.ZodType>(rule: T) =>
  z
    .preprocess(
      (typed) => (typeof typed === "string" && typed.trim() === "" ? null : typed),
      rule.nullable(),
    )
    .optional();

/** Any of the wizard's fields; each one given is checked by its own rule. */
export const draftFieldsSchema = z.object({
  listingType: clearable(listingType),
  propertyType: clearable(propertyType),
  address: clearable(address),
  locality: clearable(locality),
  city: clearable(city),
  pincode: clearable(pincode),
  bhk: clearable(bhk),
  bathrooms: clearable(bathrooms),
  areaSqft: clearable(areaSqft),
  price: clearable(price),
  furnishing: clearable(furnishing),
  amenities: amenities.optional(),
  title: clearable(title),
  description: clearable(description),
});
export type DraftFields = z.infer<typeof draftFieldsSchema>;

const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

/** The first Continue: starts the draft with step 1. One key per form, so a double click makes one draft. */
export const createDraftSchema = z.object({
  fields: draftFieldsSchema,
  idempotencyKey: z.uuid({ error: "validation.invalid" }),
});
export type CreateDraftInput = z.infer<typeof createDraftSchema>;

/** Continue on a later step, or "Save draft". */
export const saveDraftSchema = z.object({ listingId: uuid, fields: draftFieldsSchema });
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export const deleteDraftSchema = z.object({ listingId: uuid });
export type DeleteDraftInput = z.infer<typeof deleteDraftSchema>;

/** Submit for review. The key stops a double click from running twice. */
export const submitListingSchema = z.object({
  listingId: uuid,
  idempotencyKey: z.uuid({ error: "validation.invalid" }),
});
export type SubmitListingInput = z.infer<typeof submitListingSchema>;

/**
 * Mark a Live listing as sold or rented (S6-T03, FR-ACC-10). The outcome has to fit the listing (sold for a sale
 * listing, rented for a rent listing); the database checks that, and that the listing is the caller's and Live.
 */
export const closeListingSchema = z.object({
  listingId: uuid,
  outcome: z.enum(["sold", "rented"], { error: "validation.invalid" }),
});
export type CloseListingInput = z.infer<typeof closeListingSchema>;

/**
 * Save the changes to a listing that is not a draft any more (S6-T05, FR-ACC-09): one in review, Live or not
 * approved. Any of the wizard's fields; each one given is checked by its own rule.
 */
export const saveListingChangesSchema = z.object({ listingId: uuid, fields: draftFieldsSchema });
export type SaveListingChangesInput = z.infer<typeof saveListingChangesSchema>;

/** Delete one of the caller's own listings in any state (S6-T03, FR-ACC-11). */
export const deleteListingSchema = z.object({ listingId: uuid });
export type DeleteListingInput = z.infer<typeof deleteListingSchema>;
