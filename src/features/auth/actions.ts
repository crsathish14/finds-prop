"use server";

import { defineAction } from "@/server/actions/define-action";
import { createServerSupabase } from "@/server/supabase/server";
import { ActionError } from "@/server/actions/normalise-error";
import { publicEnv } from "@/lib/public-env";
import { AUTH_CONFIRM_PATH } from "@/lib/url/language-free";
import {
  addEmailConfig,
  resendEmailLinkConfig,
  saveProfileNameConfig,
  sendPhoneCodeConfig,
  signOutConfig,
  verifyPhoneCodeConfig,
} from "./action-config";
import { addEmailAddress, resendEmailAddress } from "./email-service";
import { updateProfileName } from "./profile-service";
import { endSession } from "./sign-out-service";
import { confirmPhoneCode, requestPhoneCode } from "./service";

async function phoneCodeClient() {
  const supabase = await createServerSupabase();
  return {
    signInWithOtp: (credentials: Parameters<typeof supabase.auth.signInWithOtp>[0]) =>
      supabase.auth.signInWithOtp(credentials),
    verifyOtp: (credentials: { phone: string; token: string; type: "sms" }) =>
      supabase.auth.verifyOtp(credentials),
    // Through the visitor's own session, so the database lets them read only their own row.
    readProfileName: async (userId: string) => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      return error || !data ? null : { fullName: data.full_name };
    },
  };
}

/**
 * Sends the sign-in code to a phone. It runs through defineAction, not from the browser, so the
 * per-phone and per-address limits and the number check cannot be skipped (R-BE-01, R-BE-08).
 */
export const sendPhoneCode = defineAction({
  ...sendPhoneCodeConfig,
  handler: async ({ input }) => requestPhoneCode(await phoneCodeClient(), input),
});

/**
 * Checks the code and signs the visitor in. The session cookies are set by the cookie-bound server
 * client; the page the visitor goes to next is chosen by the screen from a checked address, and
 * nothing here says who the visitor is or what they may open (R-BE-03).
 */
export const verifyPhoneCode = defineAction({
  ...verifyPhoneCodeConfig,
  handler: async ({ input }) => confirmPhoneCode(await phoneCodeClient(), input),
});

/**
 * Saves the signed-in visitor's own name (ADD-04). The row is the session user's: the name is the only
 * thing taken from the caller, and the database lets a customer change nothing else (R-BE-03).
 */
export const saveProfileName = defineAction({
  ...saveProfileNameConfig,
  handler: async ({ input, session }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "A signed-in user is required");
    const supabase = await createServerSupabase();
    return updateProfileName(
      {
        updateName: async (userId, fullName) => {
          const { data, error } = await supabase
            .from("profiles")
            .update({ full_name: fullName })
            .eq("id", userId)
            .select("id");
          return { error, updated: data?.length ?? 0 };
        },
      },
      session.userId,
      input,
    );
  },
});

async function emailLinkClient() {
  const supabase = await createServerSupabase();
  return {
    updateEmail: (email: string) =>
      supabase.auth.updateUser(
        { email },
        // Only used if the project's email template still has the default link; ours points at the same page.
        { emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}${AUTH_CONFIRM_PATH}` },
      ),
    resendEmail: (email: string) => supabase.auth.resend({ type: "email_change", email }),
  };
}

/**
 * Attaches an email to the signed-in customer's account; Supabase sends the single-use link. The
 * account is the session's, and the limits apply before any email is sent (R-BE-01, R-BE-03, R-BE-08).
 */
export const addEmail = defineAction({
  ...addEmailConfig,
  handler: async ({ input }) => addEmailAddress(await emailLinkClient(), input),
});

/** Sends the link again for the address the visitor already entered. It counts against the same limits. */
export const resendEmailLink = defineAction({
  ...resendEmailLinkConfig,
  handler: async ({ input }) => resendEmailAddress(await emailLinkClient(), input),
});

/**
 * Ends this browser's session, for a customer or for staff. The cookie-bound server client clears the
 * session cookies; other devices stay signed in (FR-AUTH-08: "everywhere in the browser" means every tab
 * of this browser, which share its cookies).
 */
export const signOut = defineAction({
  ...signOutConfig,
  handler: async () => {
    const supabase = await createServerSupabase();
    return endSession({ signOut: () => supabase.auth.signOut({ scope: "local" }) });
  },
});
