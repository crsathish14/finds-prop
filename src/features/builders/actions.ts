"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { publicEnv } from "@/lib/public-env";
import {
  inviteBuilderConfig,
  resendInvitationConfig,
  setBuilderActiveConfig,
  updateBuilderConfig,
} from "./action-config";
import {
  inviteBuilder as makeInvitation,
  resendInvitation as sendAgain,
  setBuilderActive as changeActive,
  updateBuilderDetails,
} from "./builder-service";
import { BUILDER_SIGN_IN_PATH } from "./constants";
import { createBuilderStore } from "./service";

/** Where the admin tells the builder to sign in (Google only), built from our own address and never from a request header. */
function signInUrl(): string {
  return new URL(BUILDER_SIGN_IN_PATH, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
}

/**
 * Invites a builder or an agent, as the signed-in super admin: the account with a confirmed email, the builder
 * role and the record. Nothing is emailed (DEC-27), so the answer carries the sign-in address for the admin to pass
 * on. The person signs in with Google on that email and lands on this account.
 */
export const inviteBuilder = defineAction({
  ...inviteBuilderConfig,
  handler: async ({ input, session, log, requestId }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await makeInvitation(createBuilderStore(requestId), input);
    log.info("builder invited", { builderId: done.builderId, kind: input.kind });
    return { ...done, signInUrl: signInUrl() };
  },
});

/** Shows the sign-in address of a builder who has not signed in yet, and stamps the invitation as sent again. */
export const resendInvitation = defineAction({
  ...resendInvitationConfig,
  handler: async ({ input, session, log, requestId }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await sendAgain(createBuilderStore(requestId), input);
    log.info("builder invitation sent again", { builderId: done.builderId });
    return { ...done, signInUrl: signInUrl() };
  },
});

/** Activates or deactivates a builder. A deactivated builder loses the portal and leaves the developer showcase. */
export const setBuilderActive = defineAction({
  ...setBuilderActiveConfig,
  handler: async ({ input, session, log, requestId }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await changeActive(createBuilderStore(requestId), input);
    log.info("builder access changed", { builderId: done.builderId, active: done.active });
    return done;
  },
});

/** Saves a builder's details (not the email). */
export const updateBuilder = defineAction({
  ...updateBuilderConfig,
  handler: async ({ input, session, log, requestId }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await updateBuilderDetails(createBuilderStore(requestId), input);
    log.info("builder details saved", { builderId: done.builderId });
    return done;
  },
});
