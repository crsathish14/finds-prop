import { ActionError } from "@/server/actions/normalise-error";
import { buildStaffCallbackUrl } from "@/server/auth/staff-sign-in";
import type { StartStaffGoogleSignInInput } from "./schemas";

export interface StaffGoogleSignInDeps {
  /** Supabase's signInWithOAuth, reached through the cookie-bound server client. */
  signInWithOAuth(credentials: {
    provider: "google";
    options: { redirectTo: string; skipBrowserRedirect: boolean };
  }): Promise<{ data: { url: string | null }; error: unknown }>;
  /** NEXT_PUBLIC_SITE_URL: where Google sends the visitor back, never taken from a request header. */
  siteUrl: string;
  /** NEXT_PUBLIC_SUPABASE_URL: the only host the sign-in address may point at. */
  supabaseUrl: string;
}

/**
 * Asks Supabase for the Google sign-in address. The server client keeps the PKCE verifier in the
 * visitor's cookies, so the callback can finish the exchange. The address is checked before it is
 * handed to the browser: it must be on the project's own Supabase host.
 */
export async function createStaffGoogleSignIn(
  deps: StaffGoogleSignInDeps,
  input: StartStaffGoogleSignInInput,
): Promise<{ url: string }> {
  const { data, error } = await deps.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildStaffCallbackUrl(deps.siteUrl, input.area, input.next),
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) {
    throw new ActionError("UPSTREAM_FAILED", "Supabase did not return a Google sign-in address");
  }
  if (new URL(data.url).origin !== new URL(deps.supabaseUrl).origin) {
    throw new ActionError(
      "UPSTREAM_FAILED",
      "The Google sign-in address is not on the project host",
    );
  }
  return { url: data.url };
}
