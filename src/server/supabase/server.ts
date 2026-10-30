import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "@/types/database.types";

/**
 * Per-request client bound to the caller's cookies and the publishable key, so Row Level
 * Security applies as that user. The session is refreshed only in proxy.ts (ADR-008): this
 * client never refreshes, so cookie writes from a Server Component are ignored.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component: cookies are read-only there. proxy.ts owns refresh.
          }
        },
      },
    },
  );
}
