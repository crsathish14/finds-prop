"use server";

import { defineAction } from "@/server/actions/define-action";
import { createServerSupabase } from "@/server/supabase/server";
import { sendPhoneCodeConfig } from "./action-config";
import { requestPhoneCode } from "./service";

/**
 * Sends the sign-in code to a phone. It runs through defineAction, not from the browser, so the
 * per-phone and per-address limits and the number check cannot be skipped (R-BE-01, R-BE-08).
 */
export const sendPhoneCode = defineAction({
  ...sendPhoneCodeConfig,
  handler: async ({ input }) => {
    const supabase = await createServerSupabase();
    return requestPhoneCode(
      { signInWithOtp: (credentials) => supabase.auth.signInWithOtp(credentials) },
      input,
    );
  },
});
