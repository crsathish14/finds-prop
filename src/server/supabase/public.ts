import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "@/types/database.types";

/**
 * Cookie-less client for cacheable public reads (inside "use cache"). It carries no user, so it
 * sees exactly what the anonymous role may see. Never use it for anything user specific.
 */
export function createPublicSupabase() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}
