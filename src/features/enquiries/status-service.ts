import { ActionError } from "@/server/actions/normalise-error";
import type { SetEnquiryStatusInput } from "./schemas";

/**
 * The owner's change of an enquiry's status (S6-T03), apart from the code that reaches the database so the
 * rules can be tested with a stand-in. The real store is in `status-store.ts` and acts as the signed-in
 * owner, under Row Level Security: nothing here uses the service role. The database holds the rules that
 * must not be walked around (only the owner of the listing may change the row, only its status, only
 * forward; `guard_enquiries`); this file turns what it answers into the closed set of action errors.
 */

/** Calls made as the signed-in owner. */
export interface EnquiryStatusStore {
  /** Changes the status; false when no such enquiry is visible to the caller as its owner. */
  setStatus(enquiryId: string, status: SetEnquiryStatusInput["status"]): Promise<boolean>;
}

/** What the database says when a call fails. */
export interface StatusFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/**
 * Turns what the database raises into the closed set of action errors. A move the guard refuses (back from
 * Closed, or back to New) is a conflict, which the screen answers by reading the list again; anything else
 * is ours.
 */
export function mapEnquiryStatusError(failure: StatusFailure): ActionError {
  if (failure.message === "enquiries.status_transition") {
    return new ActionError("CONFLICT", "The enquiry cannot move to that status from where it is");
  }
  if (failure.code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  return new ActionError("INTERNAL", "The enquiry could not be changed");
}

/**
 * Moves an enquiry on one of the caller's own listings. Someone else's enquiry, and one that does not exist,
 * look the same: the caller cannot see it, so nothing is found.
 */
export async function moveEnquiry(
  store: EnquiryStatusStore,
  input: SetEnquiryStatusInput,
): Promise<{ enquiryId: string; status: SetEnquiryStatusInput["status"] }> {
  const changed = await store.setStatus(input.enquiryId, input.status);
  if (!changed) throw new ActionError("NOT_FOUND", "The enquiry was not found");
  return { enquiryId: input.enquiryId, status: input.status };
}
