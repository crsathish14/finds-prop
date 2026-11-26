"use server";

import { after } from "next/server";
import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { createServerSupabase } from "@/server/supabase/server";
import { publicEnv } from "@/lib/public-env";
import {
  inviteBuilderConfig,
  resendInvitationConfig,
  setBuilderActiveConfig,
  updateBuilderConfig,
  updateMyProfileConfig,
} from "./action-config";
import {
  inviteBuilder as makeInvitation,
  resendInvitation as sendAgain,
  setBuilderActive as changeActive,
  updateBuilderDetails,
} from "./builder-service";
import { BUILDER_SIGN_IN_PATH } from "./constants";
import { saveMyProfile } from "./profile-service";
import { sendInvitationMail } from "./send-invitation-mail";
import { createBuilderStore } from "./service";

/** Where the admin tells the builder to sign in (Google only), built from our own address and never from a request header. */
function signInUrl(): string {
  return new URL(BUILDER_SIGN_IN_PATH, publicEnv.NEXT_PUBLIC_SITE_URL).toString();
}

/**
 * Invites a builder or an agent, as the signed-in super admin: the account with a confirmed email, the builder
 * role and the record. Once all of that is stored, the person is greeted by email with the sign-in address and the
 * kind of account (ADR-203), after the answer is sent; a mail that fails is logged and never changes the answer. The
 * answer also carries the sign-in address, so the admin can pass it on too. The person signs in with Google on that
 * email and lands on this account.
 */
export const inviteBuilder = defineAction({
  ...inviteBuilderConfig,
  handler: async ({ input, session, log, requestId }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await makeInvitation(createBuilderStore(requestId), input);
    log.info("builder invited", { builderId: done.builderId, kind: input.kind });
    after(() =>
      sendInvitationMail({ name: input.name, email: input.email, kind: input.kind }, requestId),
    );
    return { ...done, signInUrl: signInUrl() };
  },
});

/** Mails the greeting again to a builder who has not signed in yet, shows the sign-in address and stamps the invitation as sent again. */
export const resendInvitation = defineAction({
  ...resendInvitationConfig,
  handler: async ({ input, session, log, requestId }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await sendAgain(createBuilderStore(requestId), input);
    log.info("builder invitation sent again", { builderId: done.builderId });
    after(() => sendInvitationMail(done.mail, requestId));
    return { builderId: done.builderId, signInUrl: signInUrl() };
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

/** Saves the signed-in builder's own company profile, as themselves. No approval is needed for a profile change. */
export const updateMyProfile = defineAction({
  ...updateMyProfileConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a builder; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveMyProfile(await createServerSupabase(), input);
    log.info("builder profile saved", { builderId: done.builderId });
    return done;
  },
});
