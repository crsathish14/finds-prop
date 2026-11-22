import "server-only";
import { getSessionView } from "@/server/auth/get-session-view";

/**
 * The login wall's one question for a list page (ADR-171): is the visitor signed out? True: the page draws the
 * wall, with the phone sign-in inside it, and reads nothing. False: the page reads and draws the real list. The
 * session is read once per request (React cache), so the page and its metadata share the answer. After the
 * visitor signs in inside the wall the page refreshes in place and this answers false.
 */
export async function isSignedOut(): Promise<boolean> {
  return (await getSessionView()) === null;
}
