import { ActionError } from "@/server/actions/normalise-error";

/** What the service reads from a Supabase auth error. The message is never read. */
export interface SignOutError {
  code?: string | undefined;
  status?: number | undefined;
}

export interface SignOutDeps {
  /** Supabase's signOut with the local scope, through the cookie-bound server client. */
  signOut(): Promise<{ error: SignOutError | null }>;
}

/**
 * Codes that mean there was nothing left to end: the session was already gone, expired or revoked. The
 * visitor is signed out either way, so these are a success, not an error.
 */
const ALREADY_ENDED: ReadonlySet<string> = new Set([
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
  "bad_jwt",
  "no_authorization",
  "user_not_found",
]);

/**
 * Ends this browser's session. An error other than "already ended" is reported, because the library may
 * then leave the cookies in place: telling the visitor they are signed out when they are not would be
 * worse than asking them to try again.
 */
export async function endSession(deps: SignOutDeps): Promise<{ signedOut: true }> {
  const { error } = await deps.signOut();
  if (error && !(error.code !== undefined && ALREADY_ENDED.has(error.code))) {
    throw new ActionError(
      (error.status ?? 0) >= 500 ? "UPSTREAM_FAILED" : "INTERNAL",
      `Supabase could not end the session (${error.code ?? "no code"})`,
    );
  }
  return { signedOut: true };
}
