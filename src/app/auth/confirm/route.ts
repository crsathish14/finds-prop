import { redirect } from "next/navigation";
import { handleEmailConfirm } from "@/server/auth/email-confirm";
import { createLogger } from "@/server/logger";
import { readRequestId } from "@/server/request-id";
import { createServerSupabase } from "@/server/supabase/server";

/**
 * Where the link in a verification email lands (S3-T09, ADD-03). Supabase's email template points
 * here with a single-use token hash. All the logic is in server/auth/email-confirm.ts; this file only
 * wires the real client. It sits outside the language routing, so proxy.ts leaves it alone.
 */
export async function GET(request: Request) {
  const requestId = readRequestId(request.headers) ?? crypto.randomUUID();
  const query = new URL(request.url).searchParams;
  const supabase = await createServerSupabase();

  const destination = await handleEmailConfirm(
    { tokenHash: query.get("token_hash"), type: query.get("type") },
    {
      verifyOtp: (credentials) => supabase.auth.verifyOtp(credentials),
      log: createLogger().child({ requestId, route: "email-confirm" }),
    },
  );
  // Outside any try block: redirect() works by throwing.
  redirect(destination);
}
