"use server";

import { publicEnv } from "@/lib/public-env";
import { defineAction } from "@/server/actions/define-action";
import { createServerSupabase } from "@/server/supabase/server";
import { startStaffGoogleSignInConfig } from "./action-config";
import { createStaffGoogleSignIn } from "./service";

/**
 * Starts a staff sign-in with Google and returns the address to send the browser to. It changes no
 * data, but it sets the PKCE cookie and is open to anyone, so it runs through defineAction with a
 * rate limit (R-BE-01, R-BE-08).
 */
export const startStaffGoogleSignIn = defineAction({
  ...startStaffGoogleSignInConfig,
  handler: async ({ input }) => {
    const supabase = await createServerSupabase();
    return createStaffGoogleSignIn(
      {
        signInWithOAuth: (credentials) => supabase.auth.signInWithOAuth(credentials),
        siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
        supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      },
      input,
    );
  },
});
