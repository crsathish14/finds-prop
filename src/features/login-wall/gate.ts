import "server-only";
import { getSessionView } from "@/server/auth/get-session-view";
import { decidePageAccess } from "@/server/auth/page-access";

/**
 * The login wall's one question for a list page (ADR-171): is the visitor signed in? Signed in: null, and the
 * page reads and draws the real list. Not signed in: the address of the phone sign-in with the way back to
 * `returnTo` (a path of this site with its filters), and the page draws the wall and reads nothing. The
 * session is read once per request (React cache), so the page and its metadata share the answer.
 */
export async function loginWallHref(returnTo: string): Promise<string | null> {
  const decision = decidePageAccess("customer", await getSessionView(), returnTo);
  return decision.allowed ? null : decision.redirectTo;
}

/** True when a visitor who is not signed in is looking: the page then gets a generic, unindexed title. */
export async function isSignedOut(): Promise<boolean> {
  return (await getSessionView()) === null;
}
