import { ActionError } from "@/server/actions/normalise-error";
import type { LeadStatus } from "./constants";
import type { SetLeadStatusInput } from "./schemas";

/**
 * The rules of changing a lead's state (S7-T07, FR-ADM-06, BR-46, BR-47), apart from the code that reaches the
 * database so they can be tested with a stand-in. The real store is in `service.ts`: it acts as the signed-in
 * user, so the database's own policies decide who may change which lead (an admin any, a builder those of their own
 * projects) and its column grant lets only the state change. The action has already checked the role and counted the
 * rate limit.
 */

/** Which lead was changed and what it now says. */
export interface LeadDone {
  leadId: string;
  projectId: string;
  status: LeadStatus;
}

/** Calls made as the signed-in user. */
export interface LeadStore {
  /** Sets a lead's state; null when there is no such lead (or it is not theirs to change). */
  setStatus(leadId: string, status: LeadStatus): Promise<LeadDone | null>;
}

/** What the database says when a call fails. */
export interface LeadFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/** Turns what the database raises into the closed set of action errors. */
export function mapLeadError(failure: LeadFailure): ActionError {
  const { code, message } = failure;
  if (code === "42501" || message === "project_leads.immutable_columns") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  if (code === "23514" || code === "22P02") {
    return new ActionError("VALIDATION", "That state is not valid");
  }
  return new ActionError("INTERNAL", "The lead could not be saved");
}

export async function changeLeadStatus(
  store: LeadStore,
  input: SetLeadStatusInput,
): Promise<LeadDone> {
  const done = await store.setStatus(input.leadId, input.status);
  if (!done) throw new ActionError("NOT_FOUND", "That lead was not found");
  return done;
}
