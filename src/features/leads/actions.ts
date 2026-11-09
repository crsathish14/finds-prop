"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  loadMoreLeadsConfig,
  loadMoreMyLeadsConfig,
  loadMoreSubmissionsConfig,
  setLeadStatusConfig,
  setMyLeadStatusConfig,
} from "./action-config";
import { decodeCursor } from "./cursor";
import { changeLeadStatus } from "./lead-service";
import { getLeadsPage, getSubmissionsPage } from "./queries";
import { createLeadStore } from "./service";

/** Sets a lead's state (New, Contacted, Closed), as the signed-in super admin. The state is the only thing about a lead that can change (BR-47). */
export const setLeadStatus = defineAction({
  ...setLeadStatusConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await changeLeadStatus(await createLeadStore(), input);
    log.info("lead state changed", { leadId: done.leadId, status: done.status });
    return done;
  },
});

/** A cursor this list did not make would quietly give the first page again, so it is refused. */
function requireCursor(after: string | undefined): void {
  if (after !== undefined && decodeCursor(after) === null) {
    throw new ActionError("VALIDATION", "The page cursor is not valid", {
      fieldErrors: { after: [{ key: "validation.invalid" }] },
    });
  }
}

/** The next page of project leads after the cursor the last page gave, for "Show more". */
export const loadMoreLeads = defineAction({
  ...loadMoreLeadsConfig,
  handler: async ({ input, session }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    requireCursor(input.after);
    return getLeadsPage(input);
  },
});

/** The next page of form submissions after the cursor the last page gave, for "Show more". */
export const loadMoreSubmissions = defineAction({
  ...loadMoreSubmissionsConfig,
  handler: async ({ input, session }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    requireCursor(input.after);
    return getSubmissionsPage(input);
  },
});

/**
 * The builder's own lead actions (S7-T03). They run as the signed-in builder through their own session, so the
 * database decides whose leads they see and change: only the leads of their own projects, and only the state.
 */

/** Sets a lead's state (New, Contacted, Closed) on one of the builder's own leads. The state is the only thing about a lead that can change (BR-47). */
export const setMyLeadStatus = defineAction({
  ...setMyLeadStatusConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a builder; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await changeLeadStatus(await createLeadStore(), input);
    log.info("lead state changed by a builder", { leadId: done.leadId, status: done.status });
    return done;
  },
});

/** The next page of the builder's project leads after the cursor the last page gave, for "Show more". */
export const loadMoreMyLeads = defineAction({
  ...loadMoreMyLeadsConfig,
  handler: async ({ input, session }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    requireCursor(input.after);
    return getLeadsPage(input);
  },
});
