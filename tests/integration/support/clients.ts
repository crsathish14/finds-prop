import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type TestClient = SupabaseClient<Database>;

function requireEnvironment(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `${name} is not set; run the integration tests through vitest.integration.config.ts`,
    );
  return value;
}

const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

/** The service role: bypasses Row Level Security. Only for setting up and checking test data. */
export function adminClient(): TestClient {
  return createClient<Database>(
    requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    options,
  );
}

/** A visitor: the publishable key and no session. Sign in on it to act as a user, as the browser does. */
export function visitorClient(): TestClient {
  return createClient<Database>(
    requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    options,
  );
}
