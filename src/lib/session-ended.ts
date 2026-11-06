import type { ActionFailure } from "@/types/action";

/**
 * True when an action refused because the visitor is no longer signed in with a verified phone (S5-T07):
 * the session ended after the page was opened, or the account has no phone code behind it. Both mean the
 * same thing to the visitor: sign in again. A screen that sees this keeps what was typed, says so, and
 * offers the way back (`sessionEndedHref`); it must not show the generic "could not send".
 */
export function isSessionEnded(failure: Pick<ActionFailure, "code" | "reason">): boolean {
  return (
    failure.code === "UNAUTHENTICATED" ||
    (failure.code === "FORBIDDEN" && failure.reason === "PHONE_NOT_VERIFIED")
  );
}

/**
 * Where "Sign in again" leads: sign-in, saying why (`gate=expired`) and asking to come back to this page
 * (the address only, never a query: sign-in checks it again, BR-06). `hash` is an anchor on the page, such
 * as the enquiry card.
 */
export function sessionEndedHref(path: string, hash = ""): string {
  return `/auth?gate=expired&redirect=${encodeURIComponent(path + hash)}`;
}
