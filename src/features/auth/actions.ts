"use server";

import { defineAction } from "@/server/actions/define-action";
import { createServerSupabase } from "@/server/supabase/server";
import { ActionError } from "@/server/actions/normalise-error";
import { saveProfileNameConfig, sendPhoneCodeConfig, verifyPhoneCodeConfig } from "./action-config";
import { updateProfileName } from "./profile-service";
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
