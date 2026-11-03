import { publicEnv } from "@/lib/public-env";
import { safeRedirectPath } from "@/lib/url/safe-redirect";
import type { QueryValues } from "@/server/auth/staff-sign-in";
import { PhoneSignInScreen } from "./phone-sign-in-screen";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Reads the page's query string and shows the matching state: `?gate=enquire` says the visitor was
 * sent here by an action that needs an account, and `?redirect=` is where to go after signing in,
 * accepted only if it is a path on this site (BR-06, FR-AUTH-06). Reading search parameters means
 * the page wraps it in <Suspense>.
 */
export async function PhoneSignInFromQuery({
  searchParams,
}: {
  searchParams: Promise<QueryValues>;
}) {
  const { gate, redirect } = await searchParams;
  return (
    <PhoneSignInScreen
      siteKey={publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      gate={first(gate) === "enquire"}
      redirectTo={safeRedirectPath(first(redirect), "/dashboard")}
    />
  );
}
