import "server-only";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { getAccountSummary } from "@/features/auth";
import { getSessionView } from "@/server/auth/get-session-view";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { emailStateFrom, type EmailState } from "./email-state";

/** Who the dashboard is for. */
export interface DashboardPerson {
  /** The name the person gave, or null when they skipped that step. */
  name: string | null;
}

/**
 * The signed-in person the dashboard greets, or null when nobody is signed in. The page gate has
 * already sent a visitor away, so null only means the page renders nothing while that redirect
 * happens. The name is read as the person, so the database lets them see only their own row.
 */
export async function getDashboardPerson(): Promise<DashboardPerson | null> {
  const session = await getSessionView();
  if (!session) return null;
  const summary = await getAccountSummary(session.userId);
  return { name: summary.fullName };
}

/**
 * Where the signed-in person's email stands, read from Supabase Auth as that person. The address a
 * link was sent to (`new_email`) is not in the token, so this asks the Auth server, which also checks
 * the token. The page gate has already decided who may see the dashboard; this only reads facts about
 * the visitor's own account. A read that fails is logged without the address and gives "unknown", so
 * the dashboard shows no prompt rather than a wrong one. Computed once per request.
 */
export const getEmailState = cache(async (): Promise<EmailState> => {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      logger.warn("the email state could not be read, the dashboard shows no email prompt", {
        errorCode: error?.code ?? "no_user",
      });
      return { kind: "unknown" };
    }
    return emailStateFrom({
      email: data.user.email,
      confirmedAt: data.user.email_confirmed_at,
      pendingEmail: data.user.new_email,
    });
  } catch (error) {
    // Next.js ends a prerender by throwing from cookies(); that must reach Next.js, not be logged.
    unstable_rethrow(error);
    logger.warn("the email state could not be read, the dashboard shows no email prompt");
    return { kind: "unknown" };
  }
});
