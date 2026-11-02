/**
 * Where Supabase sends a staff member back after Google. The address is fixed in Supabase's redirect
 * list, so it carries no language prefix (S3-T10).
 */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Route handlers have no language: /api, and the sign-in callback. proxy.ts leaves these to the route. */
export function hasNoLanguage(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/") || pathname === AUTH_CALLBACK_PATH;
}
