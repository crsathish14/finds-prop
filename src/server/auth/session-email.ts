import "server-only";
import { createServerSupabase } from "../supabase/server";
import { emailFromClaims, type SessionEmail } from "./session-email-claims";

/**
 * Whether the visitor is signed in and the email on their account, read from the verified token
 * (getClaims, never getSession, AGENTS.md). The email page uses it to word "thanks, x is confirmed".
 */
export async function getSessionEmail(): Promise<SessionEmail> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  return emailFromClaims(error ? null : data?.claims);
}
