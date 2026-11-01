import "server-only";
import { redirect } from "next/navigation";
import { getSessionView } from "./get-session-view";
import { decidePageAccess, type PageArea } from "./page-access";
import type { SessionView } from "./session";

/**
 * For layouts and pages: returns the session, or redirects. Call it in the layout of a route group
 * (S3-T11) and again before reading personal data; the layout check is a convenience, not the guard
 * of record (the database rules are).
 */
export async function guardPage(area: PageArea, returnTo?: string): Promise<SessionView> {
  const decision = decidePageAccess(area, await getSessionView(), returnTo);
  if (!decision.allowed) redirect(decision.redirectTo);
  return decision.session;
}
