import { publicEnv } from "@/lib/public-env";
import { safeRedirectPath } from "@/lib/url/safe-redirect";
import { getSessionView } from "@/server/auth/get-session-view";
import { decidePageAccess } from "@/server/auth/page-access";
import type { QueryValues } from "@/server/auth/staff-sign-in";
import { PhoneSignInScreen } from "./phone-sign-in-screen";

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Reads the page's query string and shows the matching state: `?gate=enquire` says the visitor was
 * sent here by an action that needs an account, and `?redirect=` is where to go after signing in,
 * accepted only if it is a path on this site (BR-06, FR-AUTH-06). It also says whether the visitor
 * arrived already signed in. It only reports that: the screen decides what to do, because signing in
 * through this page sets a cookie, Next.js then re-renders the page on the server, and a redirect made
 * here would throw the visitor out of the name and email steps (found in the first live test,
 * 3 Nov 2026). Reading search parameters and cookies means the page wraps it in <Suspense>.
 */
export async function PhoneSignInFromQuery({
  searchParams,
}: {
  searchParams: Promise<QueryValues>;
}) {
  const { gate, redirect } = await searchParams;
  const alreadySignedIn = decidePageAccess("customer", await getSessionView()).allowed;
  return (
    <PhoneSignInScreen
      siteKey={publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      gate={first(gate) === "enquire"}
      redirectTo={safeRedirectPath(first(redirect), "/dashboard")}
      alreadySignedIn={alreadySignedIn}
    />
  );
}
