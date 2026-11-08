import type { UnitFormValues } from "@/components/domain/unit-form";
import { FACING_WORDS, UNIT_FACINGS, type UnitFacing, type UnitStatus } from "./constants";
import type { UnitView } from "./view";

/** An empty Add unit form: nothing typed, and the unit available. */
export const EMPTY_UNIT_VALUES: UnitFormValues = {
  unitNumber: "",
  floor: "",
  bhk: "",
  area: "",
  facing: "",
  price: "",
  status: "available",
  availableFrom: "",
  floorPlanUrl: "",
};

/** The direction the form's list holds for the words the database stores ("North-east" is "north-east"); none for words it does not know. */
export function facingValueOf(words: string | null): UnitFacing | "" {
  if (words === null) return "";
  const found = UNIT_FACINGS.find((facing) => FACING_WORDS[facing] === words);
  return found ?? "";
}

/** The Edit unit form's boxes for a unit: what is on record, and a blank box for anything not given. */
export function valuesOfUnit(unit: UnitView): UnitFormValues {
  return {
    unitNumber: unit.unitNumber,
    floor: unit.floor === null ? "" : String(unit.floor),
    bhk: unit.bhk === null ? "" : String(unit.bhk),
    area: unit.areaSqft === null ? "" : String(unit.areaSqft),
    facing: facingValueOf(unit.facing),
    price: unit.price === null ? "" : String(unit.price),
    status: unit.status,
    availableFrom: unit.availableFrom ?? "",
    floorPlanUrl: unit.floorPlanUrl ?? "",
  };
}

const FORM_FIELDS = new Set(Object.keys(EMPTY_UNIT_VALUES));

/** True for the name of a box on the unit form; other field names an action returns have no box. */
export function isUnitFormField(field: string): field is keyof UnitFormValues {
  return FORM_FIELDS.has(field);
}

/** The key the status badge and the form use for each state: the badge says "onHold", the database "hold". */
export const BADGE_STATUS = {
  available: "available",
  hold: "onHold",
  sold: "sold",
  blocked: "blocked",
} as const satisfies Record<UnitStatus, string>;

/** The name of each direction among the words (keys are plain names, so "north-east" is "northEast"). */
export const FACING_KEYS = {
  east: "east",
  "north-east": "northEast",
  north: "north",
  "north-west": "northWest",
  west: "west",
  "south-west": "southWest",
  south: "south",
  "south-east": "southEast",
} as const satisfies Record<UnitFacing, string>;
