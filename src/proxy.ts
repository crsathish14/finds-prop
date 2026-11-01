import { createServerClient } from "@supabase/ssr";
import createIntlProxy from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/public-env";
import { env } from "@/server/env";
import { REQUEST_ID_PATTERN } from "@/server/request-id";

/**
 * proxy.ts replaces middleware.ts in Next.js 16. It does three things for every page request:
 *  1. gives the request an id (accepted from a caller only if it looks like one);
 *  2. refreshes the Supabase session. This is the ONLY place a session is refreshed, because
 *     refresh tokens are single-use (ADR-008). Identity is checked with getClaims();
 *  3. adds environment-dependent headers: noindex outside production, and a Report-Only CSP
 *     (enforced after spike S1-SPK-02).
 * Static security headers live in next.config.ts. No authorization decisions are made here:
 * guards live in layouts and handlers (plan 07).
 */

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:54321 ws://127.0.0.1:54321",
].join("; ");

type CookieOptions = NonNullable<Parameters<NextResponse["cookies"]["set"]>[2]>;

const handleLanguage = createIntlProxy(routing);

export async function proxy(request: NextRequest) {
  const incoming = request.headers.get("x-request-id");
  const requestId = incoming && REQUEST_ID_PATTERN.test(incoming) ? incoming : crypto.randomUUID();

  // 1. Session refresh first, so the language routing below sees the refreshed cookies.
  const refreshed: { name: string; value: string; options: CookieOptions }[] = [];
  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) {
            request.cookies.set(name, value);
            refreshed.push({ name, value, options: options ?? {} });
          }
        },
      },
    },
  );

  // Verifies the token signature and refreshes the cookies when needed. Do not run other
  // Supabase calls between creating the client and this line.
  await supabase.auth.getClaims();

  // 2. Language routing (rewrite or redirect). Route handlers under /api have no language.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = request.nextUrl.pathname.startsWith("/api")
    ? NextResponse.next({ request: { headers: requestHeaders } })
    : handleLanguage(new NextRequest(request, { headers: requestHeaders }));

  for (const { name, value, options } of refreshed) response.cookies.set(name, value, options);

  response.headers.set("x-request-id", requestId);
  response.headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  if (env.APP_ENV !== "production") response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  // Skip static assets. Route handlers under /api run the proxy too, so they get a request id.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
