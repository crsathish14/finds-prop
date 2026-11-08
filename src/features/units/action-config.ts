import { tagsAfterProjectChange } from "@/lib/cache-tags";
import type { UnitDone } from "./unit-service";
import { addUnitSchema, deleteUnitSchema, unitFilterSchema, updateUnitSchema } from "./schemas";

/**
 * How the admin's unit actions run, kept apart from the "use server" file so a test can build them (S7-T07).
 * Only a super admin may call them, and each write is limited with the admin's other edits (`admin_edit`, 600 an
 * hour: entering a project of a few hundred units is well inside it, a stuck script is not). No idempotency key:
 * adding the same unit number twice is refused by the database (unit numbers are unique in a project), and the
 * other two set a value or delete a row that is already gone. A unit shows on its project's public page, so a
 * change refreshes that page and the lists. The database does not audit units, so each write adds its own entry to
 * the audit log, with the admin as the actor and the unit's id (no details of the unit).
 */
export const addUnitConfig = {
  name: "addUnit",
  input: addUnitSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: (done: UnitDone) => tagsAfterProjectChange(done.projectSlug),
  audit: {
    action: "unit.created",
    entity: (done: UnitDone) => ({ type: "unit", id: done.unitId }),
  },
};

export const updateUnitConfig = {
  name: "updateUnit",
  input: updateUnitSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: (done: UnitDone) => tagsAfterProjectChange(done.projectSlug),
  audit: {
    action: "unit.updated",
    entity: (done: UnitDone) => ({ type: "unit", id: done.unitId }),
  },
};

export const deleteUnitConfig = {
  name: "deleteUnit",
  input: deleteUnitSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: (done: UnitDone) => tagsAfterProjectChange(done.projectSlug),
  audit: {
    action: "unit.deleted",
    entity: (done: UnitDone) => ({ type: "unit", id: done.unitId }),
  },
};

/**
 * "Show more" on the Units page (S7-T07): a read, so it changes nothing and has no cache tags, audit entry or
 * idempotency key. Only a super admin may call it. It has no rate limit of its own: each call reads one page of 25
 * for a person who is already signed in as an admin.
 */
export const loadMoreUnitsConfig = {
  name: "loadMoreUnits",
  input: unitFilterSchema,
  auth: { role: "super_admin" as const },
};
