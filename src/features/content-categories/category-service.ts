import { ActionError } from "@/server/actions/normalise-error";
import type { CreateCategoryInput, UpdateCategoryInput } from "./schemas";

/**
 * The rules of the admin's category manager (ADR-143), apart from the code that reaches the database so they can be
 * tested with a stand-in. The real store is in `service.ts` and acts as the signed-in admin through their own session:
 * the table's policies let only the super admin write categories, so nothing here uses the service role. This file turns
 * what the database answers into the closed set of action errors and decides what each action answers.
 */

/** The columns of a category the admin writes. */
export interface CategoryRow {
  module: string;
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
}

/** What the store answers after a write: the category's id, list and slug. */
export interface CategoryDone {
  categoryId: string;
  module: string;
  slug: string;
}

/** Calls made as the signed-in admin. Each throws the database's failure through `mapCategoryError`. */
export interface CategoryStore {
  insert(row: CategoryRow): Promise<CategoryDone>;
  /** The list is not a column to change: a category stays in the list it was made in. */
  update(categoryId: string, row: Omit<CategoryRow, "module">): Promise<CategoryDone>;
  setActive(categoryId: string, active: boolean): Promise<CategoryDone>;
  remove(categoryId: string): Promise<CategoryDone>;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
}

/**
 * Turns what the database raises into the closed set of action errors. A slug already used in the list is a problem
 * with the slug box; a refusal by the policy is the admin gate; anything else is ours and is not repeated.
 */
export function mapCategoryError(failure: DatabaseFailure): ActionError {
  const { code } = failure;
  if (code === "23505") {
    return new ActionError("VALIDATION", "That slug is already used in this list", {
      fieldErrors: { slug: [{ key: "validation.categorySlugTaken" }] },
    });
  }
  if (code === "23514") {
    return new ActionError("VALIDATION", "The database refused a value", {
      fieldErrors: { _form: [{ key: "validation.invalid" }] },
    });
  }
  if (code === "P0002" || code === "PGRST116") {
    return new ActionError("NOT_FOUND", "The category was not found");
  }
  if (code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  return new ActionError("INTERNAL", "The category could not be saved");
}

export function toCategoryRow(input: CreateCategoryInput): CategoryRow {
  return {
    module: input.module,
    slug: input.slug,
    name: input.name,
    sort_order: input.sortOrder,
    active: input.active,
  };
}

export function createCategory(
  store: CategoryStore,
  input: CreateCategoryInput,
): Promise<CategoryDone> {
  return store.insert(toCategoryRow(input));
}

export function saveCategory(
  store: CategoryStore,
  input: UpdateCategoryInput,
): Promise<CategoryDone> {
  return store.update(input.categoryId, {
    slug: input.slug,
    name: input.name,
    sort_order: input.sortOrder,
    active: input.active,
  });
}

export function switchCategory(
  store: CategoryStore,
  parameters: { categoryId: string; active: boolean },
): Promise<CategoryDone> {
  return store.setActive(parameters.categoryId, parameters.active);
}

export function deleteCategoryById(
  store: CategoryStore,
  parameters: { categoryId: string },
): Promise<CategoryDone> {
  return store.remove(parameters.categoryId);
}
