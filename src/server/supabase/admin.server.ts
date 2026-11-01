import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "@/types/database.types";
import { env } from "../env";
import { requestIdHeaders } from "../request-id";

/**
 * Service-role client. It BYPASSES Row Level Security, so it may be imported only by the
 * allow-listed modules (R-BE-07; the list is in eslint.config.mjs and docs/engineering/security.md).
 * Extending the allow-list is a class C2 change. Never use it for user-facing reads.
 * Pass the request id so audit entries made through it name the request.
 */
export function createAdminSupabase(requestId?: string) {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: requestIdHeaders(requestId) },
  });
}
