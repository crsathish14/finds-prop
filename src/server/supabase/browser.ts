import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "@/types/database.types";

/**
 * Browser client: publishable key and the user's session only. Used for Storage uploads to a
 * signed URL and the Auth methods that flows require (OTP verify, MFA challenge). There is no
 * browser-side table access (plan 06 section 8).
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
