"use server";

import { defineAction } from "@/server/actions/define-action";
import { createServerSupabase } from "@/server/supabase/server";
import { sendPhoneCodeConfig, verifyPhoneCodeConfig } from "./action-config";
import { confirmPhoneCode, requestPhoneCode } from "./service";

async function phoneCodeClient() {
  const supabase = await createServerSupabase();
  return {
    signInWithOtp: (credentials: Parameters<typeof supabase.auth.signInWithOtp>[0]) =>
      supabase.auth.signInWithOtp(credentials),
    verifyOtp: (credentials: { phone: string; token: string; type: "sms" }) =>
      supabase.auth.verifyOtp(credentials),
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
