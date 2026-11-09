"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  addMyUnitConfig,
  addUnitConfig,
  deleteMyUnitConfig,
  deleteUnitConfig,
  loadMoreMyUnitsConfig,
  loadMoreUnitsConfig,
  updateMyUnitConfig,
  updateUnitConfig,
} from "./action-config";
import { getMyUnitsPage, getUnitsPage } from "./queries";
import { createUnitStore } from "./service";
import { addUnitTo, removeUnit, saveUnit } from "./unit-service";

/** Adds a unit to a project, as the signed-in super admin. Answers the unit's id and its project, for the page to refresh. */
export const addUnit = defineAction({
  ...addUnitConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await addUnitTo(await createUnitStore(), input);
    log.info("unit added", { unitId: done.unitId, projectId: done.projectId });
    return done;
  },
});

/** Saves a unit's details. A unit never moves to another project. */
export const updateUnit = defineAction({
  ...updateUnitConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveUnit(await createUnitStore(), input);
    log.info("unit saved", { unitId: done.unitId, projectId: done.projectId });
    return done;
  },
});

/** Deletes a unit. A project's leads do not depend on its units, so nothing blocks this. */
export const deleteUnit = defineAction({
  ...deleteUnitConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await removeUnit(await createUnitStore(), input.unitId);
    log.info("unit deleted", { unitId: done.unitId, projectId: done.projectId });
    return done;
  },
});

/** The next page of a project's units after the unit number the last page ended on, for "Show more". */
export const loadMoreUnits = defineAction({
  ...loadMoreUnitsConfig,
  handler: async ({ input, session }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    return getUnitsPage(input);
  },
});

/**
 * The builder's own unit actions (S7-T03). They run as the signed-in builder through their own session, so the
 * database's policies decide whose units they may touch: a project or unit that is not theirs is refused or
 * "not found", whatever is sent.
 */

/** Adds a unit to one of the signed-in builder's projects. Answers the unit's id and its project, for the page to refresh. */
export const addMyUnit = defineAction({
  ...addMyUnitConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a builder; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await addUnitTo(await createUnitStore(), input);
    log.info("unit added by a builder", { unitId: done.unitId, projectId: done.projectId });
    return done;
  },
});

/** Saves a unit's details. A unit never moves to another project. */
export const updateMyUnit = defineAction({
  ...updateMyUnitConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveUnit(await createUnitStore(), input);
    log.info("unit saved by a builder", { unitId: done.unitId, projectId: done.projectId });
    return done;
  },
});

/** Deletes a unit of the builder's own project. */
export const deleteMyUnit = defineAction({
  ...deleteMyUnitConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await removeUnit(await createUnitStore(), input.unitId);
    log.info("unit deleted by a builder", { unitId: done.unitId, projectId: done.projectId });
    return done;
  },
});

/** The next page of one of the builder's projects' units, for "Show more"; "not found" for a project that is not theirs. */
export const loadMoreMyUnits = defineAction({
  ...loadMoreMyUnitsConfig,
  handler: async ({ input, session }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const page = await getMyUnitsPage(input);
    if (!page) throw new ActionError("NOT_FOUND", "That project was not found");
    return page;
  },
});
