/**
 * Where Supabase sends a staff member back after Google. The address is fixed in Supabase's redirect
 * list, so it carries no language prefix (S3-T10).
 */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Where the link in a verification email lands (S3-T09). Fixed in Supabase's email template and redirect list. */
export const AUTH_CONFIRM_PATH = "/auth/confirm";

/** Route handlers have no language: /api, the sign-in callback and the email link. proxy.ts leaves these to the route. */
export function hasNoLanguage(pathname: string): boolean {
  return (
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === AUTH_CALLBACK_PATH ||
    pathname === AUTH_CONFIRM_PATH
  );
}
