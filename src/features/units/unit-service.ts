import { ActionError } from "@/server/actions/normalise-error";
import { FACING_WORDS, type UnitStatus } from "./constants";
import type { AddUnitInput, UpdateUnitInput } from "./schemas";

/**
 * The rules of the admin's unit management (S7-T07, FR-ADM-05), apart from the code that reaches the database so
 * they can be tested with a stand-in. The real store is in `service.ts`: it acts as the signed-in admin, so the
 * database's own policies decide what may be written (an admin may add, change and delete the units of any project;
 * a unit never moves to another project; a project's unit numbers are unique). The action has already checked
 * that the caller is the super admin and counted the rate limit.
 */

/** The columns of a unit the admin writes. A column that is not in the object is left as it is. */
export interface UnitRow {
  unit_number?: string;
  floor_number?: number | null;
  bhk?: number | null;
  area_sqft?: number | null;
  facing?: string | null;
  price?: number | null;
  available_from?: string | null;
  floor_plan_path?: string | null;
  status?: UnitStatus;
}

/** Which unit was changed and where it lives: enough to refresh the project's public page. */
export interface UnitDone {
  unitId: string;
  projectId: string;
  projectSlug: string;
}

/** Calls made as the signed-in admin. */
export interface UnitStore {
  /** Adds a unit to a project. Throws the database's failure through `mapUnitError`. */
  insert(projectId: string, row: UnitRow & { unit_number: string }): Promise<UnitDone>;
  /** Saves a unit; null when there is no such unit. */
  update(unitId: string, row: UnitRow): Promise<UnitDone | null>;
  /** Deletes a unit; null when there is no such unit. */
  remove(unitId: string): Promise<UnitDone | null>;
}

/** What the database says when a call fails. */
export interface UnitFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/**
 * Turns what the database raises into the closed set of action errors. A unit number that is already used in the
 * project is a problem with that box; a project that is not there is not found; anything else is ours.
 */
export function mapUnitError(failure: UnitFailure): ActionError {
  const { code, message } = failure;
  if (code === "23505") {
    return new ActionError("VALIDATION", "That unit number is already used in this project", {
      fieldErrors: { unitNumber: [{ key: "validation.unitNumberTaken" }] },
    });
  }
  if (code === "23503") return new ActionError("NOT_FOUND", "That project was not found");
  if (code === "42501")
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  if (message === "project_units.project_immutable") {
    return new ActionError("VALIDATION", "A unit cannot move to another project");
  }
  if (code === "23514" || code === "22P02" || code === "23502" || code === "22003") {
    return new ActionError("VALIDATION", "The unit's details are not valid");
  }
  return new ActionError("INTERNAL", "The unit could not be saved");
}

/** The columns from what the form gave: a value not given is left out, a blank box (null) clears the column. */
export function unitRowFrom(
  input: AddUnitInput | UpdateUnitInput,
): UnitRow & { unit_number: string } {
  const row: UnitRow & { unit_number: string } = {
    unit_number: input.unitNumber,
    status: input.status,
  };
  if (input.floor !== undefined) row.floor_number = input.floor;
  if (input.bhk !== undefined) row.bhk = input.bhk;
  if (input.area !== undefined) row.area_sqft = input.area;
  if (input.facing !== undefined) {
    row.facing = input.facing === null ? null : FACING_WORDS[input.facing];
  }
  if (input.price !== undefined) row.price = input.price;
  if (input.availableFrom !== undefined) row.available_from = input.availableFrom;
  if (input.floorPlanUrl !== undefined) row.floor_plan_path = input.floorPlanUrl;
  return row;
}

export async function addUnitTo(store: UnitStore, input: AddUnitInput): Promise<UnitDone> {
  return store.insert(input.projectId, unitRowFrom(input));
}

export async function saveUnit(store: UnitStore, input: UpdateUnitInput): Promise<UnitDone> {
  const done = await store.update(input.unitId, unitRowFrom(input));
  if (!done) throw new ActionError("NOT_FOUND", "That unit was not found");
  return done;
}

export async function removeUnit(store: UnitStore, unitId: string): Promise<UnitDone> {
  const done = await store.remove(unitId);
  if (!done) throw new ActionError("NOT_FOUND", "That unit was not found");
  return done;
}
