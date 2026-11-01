import { safeRedirectPath } from "@/lib/url/safe-redirect";
import type { SessionView } from "./session";

/** The three areas a page can belong to (plan 07 sections 2.2 to 2.6). */
export type PageArea = "customer" | "builder" | "admin";

export type PageDecision =
  { allowed: true; session: SessionView } | { allowed: false; redirectTo: string };

const deny = (redirectTo: string): PageDecision => ({ allowed: false, redirectTo });

/**
 * Pure: where a visitor goes when they may not see a page. The destination never says why an
 * account was refused, except that a builder sees a "no access" notice on their own sign-in page.
 * The routes themselves are built in S3-T10 and S3-T11.
 */
export function decidePageAccess(
  area: PageArea,
  session: SessionView | null,
  returnTo?: string,
): PageDecision {
  if (area === "customer") {
    if (!session) return deny(`/auth?redirect=${encodeURIComponent(safeRedirectPath(returnTo))}`);
    return { allowed: true, session };
  }
  if (area === "builder") {
    if (!session) return deny("/builder/login");
    if (session.builderId === null || !session.roles.includes("builder")) {
      return deny("/builder/login?denied=1");
    }
    return { allowed: true, session };
  }
  if (!session) return deny("/admin/login");
  if (!session.roles.includes("super_admin")) return deny("/");
  return { allowed: true, session };
}
