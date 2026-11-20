import { ActionError } from "@/server/actions/normalise-error";
import { FAQ_SORT_MAX, type FaqStatus } from "./constants";
import type { CreateFaqInput, ReorderFaqsInput, UpdateFaqInput } from "./schemas";

/**
 * The rules of the FAQ admin (ADR-143), apart from the code that reaches the database so they can be tested with a
 * stand-in. The real store is in `service.ts` and acts as the signed-in admin through their own session: the table's
 * policies let only the super admin write questions, so nothing here uses the service role. This file decides what each
 * action writes and turns what the database answers into the closed set of action errors.
 *
 * The rules the database also holds: a question belongs to a category of the FAQ list (a trigger), a question in the
 * trash is a draft (a check), and a category with questions cannot be deleted (a foreign key).
 */

/** What a save of a question writes (the columns the admin may set). */
export interface FaqChanges {
  category_id: string;
  question: string;
  answer: string;
  /** Left out, the question keeps its place. */
  sort_order?: number;
  /** Left out, the question keeps its status. */
  status?: FaqStatus;
}

/** A new question: every column is decided before it is written. */
export interface FaqNew {
  category_id: string;
  question: string;
  answer: string;
  sort_order: number;
  status: FaqStatus;
}

/** What the store answers after a write: the question, its category and the status it now has. */
export interface FaqDone {
  faqId: string;
  categoryId: string;
  status: FaqStatus;
}

/** What the order action answers: the category and how many questions were put in order. */
export interface FaqReorderDone {
  categoryId: string;
  count: number;
}

/** Calls made as the signed-in admin. Each throws the database's failure through `mapFaqError`. */
export interface FaqStore {
  insert(row: FaqNew): Promise<FaqDone>;
  /** The place after the last question of the category: one more than the highest order, or 1 for an empty one. */
  nextSortOrder(categoryId: string): Promise<number>;
  /** Questions in the trash are not edited: they are restored first. A question in the trash is "not found". */
  update(faqId: string, changes: FaqChanges): Promise<FaqDone>;
  setStatus(faqId: string, status: FaqStatus): Promise<FaqDone>;
  /** Puts a question in the trash and back to a draft in one write. */
  trash(faqId: string): Promise<FaqDone>;
  /** Takes a question out of the trash. It comes back as a draft: restoring never publishes. */
  restore(faqId: string): Promise<FaqDone>;
  reorder(categoryId: string, faqIds: string[]): Promise<number>;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
}

/**
 * Turns what the database raises into the closed set of action errors. A category that is not in the FAQ list, or does
 * not exist, is a problem with the category box; any other refused value is the form as a whole; a refusal by the
 * policy is the admin gate; a question that is missing (or in the trash) is "not found"; anything else is ours and is
 * not repeated.
 */
export function mapFaqError(failure: DatabaseFailure): ActionError {
  const { code, message } = failure;
  if (code === "23503" || (code === "23514" && (message ?? "").includes("FAQ list"))) {
    return new ActionError("VALIDATION", "That category cannot hold questions", {
      fieldErrors: { categoryId: [{ key: "validation.invalid" }] },
    });
  }
  if (code === "23514" || code === "22023") {
    return new ActionError("VALIDATION", "The database refused a value", {
      fieldErrors: { _form: [{ key: "validation.invalid" }] },
    });
  }
  if (code === "P0002" || code === "PGRST116") {
    return new ActionError("NOT_FOUND", "The question was not found");
  }
  if (code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  return new ActionError("INTERNAL", "The question could not be saved");
}

export function toFaqChanges(input: UpdateFaqInput): FaqChanges {
  return {
    category_id: input.categoryId,
    question: input.question,
    answer: input.answer,
    ...(input.sortOrder === undefined ? {} : { sort_order: input.sortOrder }),
    ...(input.status === undefined ? {} : { status: input.status }),
  };
}

/** A new question goes last in its category unless the admin gave a place; it is a draft unless said otherwise. */
export async function createFaq(store: FaqStore, input: CreateFaqInput): Promise<FaqDone> {
  const sortOrder =
    input.sortOrder ?? Math.min(await store.nextSortOrder(input.categoryId), FAQ_SORT_MAX);
  return store.insert({
    category_id: input.categoryId,
    question: input.question,
    answer: input.answer,
    sort_order: sortOrder,
    status: input.status ?? "draft",
  });
}

export function saveFaq(store: FaqStore, input: UpdateFaqInput): Promise<FaqDone> {
  return store.update(input.faqId, toFaqChanges(input));
}

export function publishFaqById(store: FaqStore, parameters: { faqId: string }): Promise<FaqDone> {
  return store.setStatus(parameters.faqId, "published");
}

export function unpublishFaqById(store: FaqStore, parameters: { faqId: string }): Promise<FaqDone> {
  return store.setStatus(parameters.faqId, "draft");
}

export function trashFaqById(store: FaqStore, parameters: { faqId: string }): Promise<FaqDone> {
  return store.trash(parameters.faqId);
}

export function restoreFaqById(store: FaqStore, parameters: { faqId: string }): Promise<FaqDone> {
  return store.restore(parameters.faqId);
}

export async function reorderFaqList(
  store: FaqStore,
  input: ReorderFaqsInput,
): Promise<FaqReorderDone> {
  const count = await store.reorder(input.categoryId, input.faqIds);
  return { categoryId: input.categoryId, count };
}
