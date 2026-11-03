import { publicEnv } from "@/lib/public-env";
import type { QueryValues } from "@/server/auth/staff-sign-in";
import { PhoneSignInScreen } from "./phone-sign-in-screen";

/**
 * Reads the page's query string and shows the matching state: `?gate=enquire` says the visitor was
 * sent here by an action that needs an account. Reading search parameters means the page wraps it in
 * <Suspense>.
 */
export async function PhoneSignInFromQuery({
  searchParams,
}: {
  searchParams: Promise<QueryValues>;
}) {
  const { gate } = await searchParams;
  return (
    <PhoneSignInScreen
      siteKey={publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
      gate={(Array.isArray(gate) ? gate[0] : gate) === "enquire"}
    />
  );
}
