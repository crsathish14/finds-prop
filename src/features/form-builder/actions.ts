"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  createFormConfig,
  deleteFormConfig,
  duplicateFormConfig,
  setFormActiveConfig,
  updateFormConfig,
} from "./action-config";
import {
  createForm as makeForm,
  deleteFormById,
  duplicateForm as copyForm,
  saveForm,
  switchForm,
} from "./builder-service";
import { createFormBuilderStore } from "./service";

/** Makes a form, as the signed-in super admin. Answers its id and slug. */
export const createForm = defineAction({
  ...createFormConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await makeForm(await createFormBuilderStore(), input);
    log.info("form created", { formId: done.formId });
    return done;
  },
});

/** Saves changes to a form. */
export const updateForm = defineAction({
  ...updateFormConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveForm(await createFormBuilderStore(), input);
    log.info("form saved", { formId: done.formId });
    return done;
  },
});

/** Switches a form on or off from the list. */
export const setFormActive = defineAction({
  ...setFormActiveConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await switchForm(await createFormBuilderStore(), input);
    log.info("form switched", { formId: done.formId, active: input.active });
    return done;
  },
});

/** Copies a form under a new name and slug, switched off. Answers the copy's id and slug. */
export const duplicateForm = defineAction({
  ...duplicateFormConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await copyForm(await createFormBuilderStore(), input);
    log.info("form duplicated", { formId: input.formId, copyId: done.formId });
    return done;
  },
});

/** Deletes a form. Projects that used it fall back to the standard enquiry form; past submissions are kept. */
export const deleteForm = defineAction({
  ...deleteFormConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await deleteFormById(await createFormBuilderStore(), input);
    log.info("form deleted", { formId: done.formId });
    return done;
  },
});
