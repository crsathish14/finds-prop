import { z } from "zod";
import {
  AREA_MAX,
  BHK_MAX,
  BHK_MIN,
  FLOOR_MAX,
  FLOOR_MIN,
  FLOOR_PLAN_LINK_MAX,
  PRICE_MAX,
  UNIT_FACINGS,
  UNIT_NUMBER_MAX,
  UNIT_SEARCH_MAX,
  UNIT_STATE_FILTERS,
  UNIT_STATUSES,
} from "./constants";

/**
 * What the admin's Units page sends (S7-T07, FR-ADM-05). A schema message is a key under `validation.*`; the
 * screen looks the words up (ADR-035). Nothing here says who is asking: the admin is the session. A box left
 * empty clears an optional field on a save; on a new unit it is simply not set.
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

/** A blank box is "no value" (null); anything else goes on to the rule. */
const clearable = <T extends z.ZodType>(rule: T) =>
  z
    .preprocess(
      (typed) => (typeof typed === "string" && typed.trim() === "" ? null : typed),
      rule.nullable(),
    )
    .optional();

/** "1,480", " 1480 " and 1480 are the same number; a word is NaN and fails the rule. */
const toNumber = (typed: unknown): unknown => {
  if (typeof typed !== "string") return typed;
  return Number(typed.replace(/[,\s]/g, ""));
};

const unitNumber = z.preprocess(
  tidy,
  z
    .string({ error: "validation.required" })
    .min(1, { error: "validation.required" })
    .max(UNIT_NUMBER_MAX, { error: "validation.invalid" })
    .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
);

const floor = clearable(
  z.preprocess(
    toNumber,
    z
      .number({ error: "validation.numberInvalid" })
      .int({ error: "validation.numberInvalid" })
      .min(FLOOR_MIN, { error: "validation.invalid" })
      .max(FLOOR_MAX, { error: "validation.invalid" }),
  ),
);

const bhk = clearable(
  z.preprocess(
    toNumber,
    z
      .number({ error: "validation.numberInvalid" })
      .int({ error: "validation.numberInvalid" })
      .min(BHK_MIN, { error: "validation.invalid" })
      .max(BHK_MAX, { error: "validation.invalid" }),
  ),
);

/** Square feet, with at most two decimals (the column is numeric(10, 2)). */
const area = clearable(
  z.preprocess(
    toNumber,
    z
      .number({ error: "validation.numberInvalid" })
      .min(0, { error: "validation.invalid" })
      .max(AREA_MAX, { error: "validation.invalid" })
      .refine((value) => Math.round(value * 100) / 100 === value, {
        error: "validation.invalid",
      }),
  ),
);

/** Rupees, whole. */
const price = clearable(
  z.preprocess(
    toNumber,
    z
      .number({ error: "validation.numberInvalid" })
      .refine(Number.isInteger, { error: "validation.numberInvalid" })
      .min(0, { error: "validation.invalid" })
      .max(PRICE_MAX, { error: "validation.invalid" }),
  ),
);

const facing = clearable(z.enum(UNIT_FACINGS, { error: "validation.invalid" }));

const status = z.enum(UNIT_STATUSES, { error: "validation.invalid" });

/** yyyy-mm-dd, a real calendar date (the date box of the browser sends this). */
const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

const availableFrom = clearable(
  z.string({ error: "validation.invalid" }).refine(isCalendarDate, { error: "validation.invalid" }),
);

/** An https link to the floor plan. The column is named for a storage path; until uploads exist it holds the link. */
const floorPlanUrl = clearable(
  z
    .string({ error: "validation.linkInvalid" })
    .trim()
    .max(FLOOR_PLAN_LINK_MAX, { error: "validation.linkInvalid" })
    .refine(
      (value) => {
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      },
      { error: "validation.linkInvalid" },
    ),
);

const unitFields = {
  unitNumber,
  floor,
  bhk,
  area,
  facing,
  price,
  status,
  availableFrom,
  floorPlanUrl,
};

export const addUnitSchema = z.object({ projectId: uuid, ...unitFields });
export type AddUnitInput = z.infer<typeof addUnitSchema>;

export const updateUnitSchema = z.object({ unitId: uuid, ...unitFields });
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;

export const deleteUnitSchema = z.object({ unitId: uuid });
export type DeleteUnitInput = z.infer<typeof deleteUnitSchema>;

const clean = (typed: unknown): unknown => {
  const first = Array.isArray(typed) ? typed[0] : typed;
  return typeof first === "string" ? first.trim() : undefined;
};

/**
 * The Units page's address bar and its "Show more": the project, a unit number to look for, the state chip and the
 * page cursor. A state or search that is not valid is dropped, so a mistyped address shows the whole list instead
 * of an error; the project is needed, and is checked.
 */
export const unitFilterSchema = z.object({
  projectId: uuid,
  state: z.preprocess(clean, z.enum(UNIT_STATE_FILTERS)).catch("all"),
  search: z.preprocess(clean, z.string().min(1).max(UNIT_SEARCH_MAX)).optional().catch(undefined),
  after: z.preprocess(clean, z.string().min(1).max(200)).optional().catch(undefined),
});
export type UnitFilters = z.infer<typeof unitFilterSchema>;
