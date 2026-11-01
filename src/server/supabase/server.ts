import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { publicEnv } from "@/lib/public-env";
import type { Database } from "@/types/database.types";
import { readRequestId, requestIdHeaders } from "../request-id";

/**
 * Per-request client bound to the caller's cookies and the publishable key, so Row Level
 * Security applies as that user. The session is refreshed only in proxy.ts (ADR-008): this
 * client never refreshes, so cookie writes from a Server Component are ignored. It sends the
 * request's x-request-id to Supabase so audit entries can name the request.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  const requestId = readRequestId(await headers());
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      global: { headers: requestIdHeaders(requestId) },
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
