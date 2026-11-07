import { ActionError } from "@/server/actions/normalise-error";
import type { Decision } from "./constants";
import type { ModerateListingInput } from "./schemas";

/**
 * The rules of the admin's decisions (S6-T04, FR-ADM-02), apart from the code that reaches the database so
 * they can be tested with a stand-in. The real store is in `service.ts` and acts as the signed-in admin
 * through their own session: nothing here uses the service role. The database holds the rules that must not
 * be walked around (who may decide, which state each decision needs, the reason; ADR-064); this file turns
 * what it answers into the closed set of action errors.
 */

/** What `moderate_listing` answers: the listing as it is after the decision. */
export interface DecisionResult {
  listingId: string;
  shortId: string;
  status: string;
  featured: boolean;
}

/** Calls made as the signed-in admin. */
export interface ModerationStore {
  /** Calls `moderate_listing`. Throws the database's failure through `mapModerationError`. */
  decide(listingId: string, decision: Decision, reason: string | null): Promise<DecisionResult>;
}

/** What the database says when a call fails. */
export interface DatabaseFailure {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
}

/**
 * Turns what the database raises into the closed set of action errors. A listing that is not in the state
 * the decision needs (another admin decided first, or the page is out of date) is a conflict the page can
 * explain; a missing reason can only come from a request that skipped the schema.
 */
export function mapModerationError(failure: DatabaseFailure): ActionError {
  const { code, message } = failure;
  if (message === "listing.reason_required" || code === "23514") {
    return new ActionError("VALIDATION", "A reason is needed to reject a listing", {
      fieldErrors: { reason: [{ key: "validation.required" }] },
    });
  }
  if (message === "listing.not_found" || code === "P0002") {
    return new ActionError("NOT_FOUND", "The listing was not found");
  }
  if (
    message === "listing.not_reviewable" ||
    message === "listing.not_featurable" ||
    code === "55000"
  ) {
    return new ActionError("CONFLICT", "The listing is not in a state this decision needs");
  }
  if (message === "listing.not_allowed" || code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  if (message === "listing.bad_action" || code === "22023") {
    return new ActionError("VALIDATION", "The decision is not one of the known ones", {
      fieldErrors: { decision: [{ key: "validation.invalid" }] },
    });
  }
  return new ActionError("INTERNAL", "The decision could not be saved");
}

/** Makes one decision. Only a rejection carries a reason; the database refuses a wrong state. */
export async function decideListing(
  store: ModerationStore,
  input: ModerateListingInput,
): Promise<DecisionResult> {
  return store.decide(
    input.listingId,
    input.decision,
    input.decision === "reject" ? input.reason : null,
  );
}
