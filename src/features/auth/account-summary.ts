import "server-only";
import { cache } from "react";
import { logger } from "@/server/logger";
import { emailFromClaims } from "@/server/auth/session-email-claims";
import { createServerSupabase } from "@/server/supabase/server";

export interface AccountSummary {
  /** The name the person gave, or null if they skipped that step. */
  fullName: string | null;
  /** The email on the account, from the verified token, or null if there is none. */
  email: string | null;
}

/**
 * What the account menu shows about the signed-in person: their name and email. Both are read as
 * the visitor, so the database lets them see only their own row, and the email comes from the
 * verified token (getClaims), never from getSession (AGENTS.md). Computed once per request. A
 * read that fails gives an empty summary and is logged, so the page still renders.
 */
export const getAccountSummary = cache(async (userId: string): Promise<AccountSummary> => {
  const supabase = await createServerSupabase();
  const [claimsResult, profile] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
  ]);
  if (profile.error) {
    logger.warn("the account name could not be read, the menu shows no name", {
      errorCode: profile.error.code,
    });
  }
  const { email } = emailFromClaims(claimsResult.error ? null : claimsResult.data?.claims);
  return { fullName: profile.error ? null : (profile.data?.full_name ?? null), email };
});
