import { redirect } from "next/navigation";
import { writeAudit } from "@/server/audit/audit";
import { loadSessionView } from "@/server/auth/get-session-view";
import { handleStaffCallback } from "@/server/auth/staff-callback";
import { createLogger } from "@/server/logger";
import { readRequestId } from "@/server/request-id";
import { createServerSupabase } from "@/server/supabase/server";

/**
 * Where Google, through Supabase, sends a staff member back (S3-T10). The browser arrives with a
 * one-time code and the cookie our own server set when the sign-in started, so no signature is
 * needed. All the logic is in server/auth/staff-callback.ts; this file only wires the real client.
 * One Supabase client does the exchange and reads the new session, so it sees its own cookies.
 */
export async function GET(request: Request) {
  const requestId = readRequestId(request.headers) ?? crypto.randomUUID();
  const query = new URL(request.url).searchParams;
  const supabase = await createServerSupabase();

  const destination = await handleStaffCallback(
    {
      code: query.get("code"),
      error: query.get("error"),
      errorDescription: query.get("error_description"),
      area: query.get("area"),
      next: query.get("next"),
    },
    {
      exchangeCode: (code) => supabase.auth.exchangeCodeForSession(code),
      readSession: () => loadSessionView(supabase),
      signOut: async () => {
        await supabase.auth.signOut({ scope: "local" });
      },
      audit: ({ action, session }) =>
        writeAudit({ action, entity: { type: "staff", id: session.userId }, session, requestId }),
      log: createLogger().child({ requestId, route: "staff-callback" }),
    },
  );
  // Outside any try block: redirect() works by throwing.
  redirect(destination);
}
