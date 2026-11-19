"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  createCategoryConfig,
  deleteCategoryConfig,
  setCategoryActiveConfig,
  updateCategoryConfig,
} from "./action-config";
import {
  createCategory as makeCategory,
  deleteCategoryById,
  saveCategory,
  switchCategory,
} from "./category-service";
import { createCategoryStore } from "./service";

/** Makes a category in a list, as the signed-in super admin. Answers its id, list and slug. */
export const createContentCategory = defineAction({
  ...createCategoryConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await makeCategory(await createCategoryStore(), input);
    log.info("content category created", { categoryId: done.categoryId, module: done.module });
    return done;
  },
});

/** Saves changes to a category. */
export const updateContentCategory = defineAction({
  ...updateCategoryConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveCategory(await createCategoryStore(), input);
    log.info("content category saved", { categoryId: done.categoryId });
    return done;
  },
});

/** Hides a category from the visitors' filters, or shows it again. */
export const setContentCategoryActive = defineAction({
  ...setCategoryActiveConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await switchCategory(await createCategoryStore(), input);
    log.info("content category switched", { categoryId: done.categoryId, active: input.active });
    return done;
  },
});

/** Deletes a category. */
export const deleteContentCategory = defineAction({
  ...deleteCategoryConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await deleteCategoryById(await createCategoryStore(), input);
    log.info("content category deleted", { categoryId: done.categoryId });
    return done;
  },
});
