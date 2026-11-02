import { AUTH_CALLBACK_PATH } from "@/lib/url/language-free";
import { isSafeRedirectPath } from "@/lib/url/safe-redirect";
import {
  STAFF_AREAS,
  STAFF_PROBLEMS,
  type StaffArea,
  type StaffProblem,
} from "@/types/staff-sign-in";
import type { SessionView } from "./session";

/**
 * Staff sign-in is Google only: no password, no reset and no second step (owner decision,
 * 1 Nov 2026). Builders and agents share the builder area; the administrator has their own.
 * Everything here is pure, so the action, the callback and the pages share one set of rules.
 */
export { STAFF_AREAS, STAFF_PROBLEMS };
export type { StaffArea, StaffProblem };

export function isStaffArea(value: unknown): value is StaffArea {
  return typeof value === "string" && (STAFF_AREAS as readonly string[]).includes(value);
}

export const STAFF_LOGIN_PATH: Record<StaffArea, string> = {
  builder: "/builder/login",
  admin: "/admin/login",
};

export const STAFF_HOME_PATH: Record<StaffArea, string> = {
  builder: "/builder/dashboard",
  admin: "/admin/dashboard",
};

export function staffLoginPath(area: StaffArea, problem?: StaffProblem): string {
  return problem ? `${STAFF_LOGIN_PATH[area]}?${problem}=1` : STAFF_LOGIN_PATH[area];
}

/** A query string as Next.js gives it to a page. */
export type QueryValues = Record<string, string | string[] | undefined>;

/** The problem a sign-in page was sent back with (`?denied=1`, `?cancelled=1`, `?error=1`), if any. */
export function parseStaffProblem(query: QueryValues): StaffProblem | null {
  for (const problem of STAFF_PROBLEMS) {
    const value = query[problem];
    if ((Array.isArray(value) ? value[0] : value) === "1") return problem;
  }
  return null;
}

/**
 * The before-user-created guard refuses a sign-up with this code. Supabase reports it as the error
 * message, with `error_code: unknown` (docs/runbooks/before-user-created-hook.md).
 */
export const SIGNUP_REFUSED_CODE = "signup_not_allowed";

/**
 * Reads the error Supabase puts in the callback's query string (`error` and `error_description`).
 * Returns null when there is none. A refused sign-up and a cancelled Google screen get their own
 * state; anything else is a plain error.
 */
export function classifyCallbackProblem(
  error: string | null | undefined,
  description: string | null | undefined,
): StaffProblem | null {
  if (!error && !description) return null;
  if (description?.includes(SIGNUP_REFUSED_CODE)) return "denied";
  if (error === "access_denied") return "cancelled";
  return "error";
}

/** Only a page inside the area, and never its own sign-in page, may be a "go back here" address. */
export function isStaffPathFor(area: StaffArea, path: unknown): path is string {
  if (!isSafeRedirectPath(path)) return false;
  const pathname = path.split(/[?#]/)[0] ?? "";
  if (pathname === STAFF_LOGIN_PATH[area]) return false;
  return pathname === `/${area}` || pathname.startsWith(`/${area}/`);
}

/**
 * The address Google sends the visitor back to. It is built from the configured site address and
 * never from a request header, so a forged Host header cannot move the sign-in to another site.
 */
export function buildStaffCallbackUrl(siteUrl: string, area: StaffArea, next?: string): string {
  const callback = new URL(AUTH_CALLBACK_PATH, siteUrl);
  callback.searchParams.set("area", area);
  if (next !== undefined && isStaffPathFor(area, next)) callback.searchParams.set("next", next);
  return callback.toString();
}

export type StaffLanding =
  | { allowed: true; redirectTo: string }
  | { allowed: false; problem: StaffProblem; redirectTo: string };

/**
 * Where a visitor lands after Google signed them in. The area only chooses which rule applies and
 * which sign-in page to return to; it can never grant access, because eligibility comes from the
 * session the server read (R-BE-03). A builder needs the role and an active builder record (BR-34);
 * the administrator needs the reserved `super_admin` role.
 */
export function decideStaffLanding(
  area: StaffArea,
  session: SessionView | null,
  next?: string | null,
): StaffLanding {
  if (!session) return refuse(area, "error");
  const eligible =
    area === "builder"
      ? session.roles.includes("builder") && session.builderId !== null
      : session.roles.includes("super_admin");
  if (!eligible) return refuse(area, "denied");
  return {
    allowed: true,
    redirectTo: isStaffPathFor(area, next) ? next : STAFF_HOME_PATH[area],
  };
}

function refuse(area: StaffArea, problem: StaffProblem): StaffLanding {
  return { allowed: false, problem, redirectTo: staffLoginPath(area, problem) };
}
