import { ActionError } from "@/server/actions/normalise-error";
import { RESEND_AFTER_SECONDS } from "./constants";
import type { AddEmailInput } from "./schemas";

/** What the service reads from a Supabase auth error. The message is never read: it can repeat the address. */
export interface EmailLinkError {
  code?: string | undefined;
  status?: number | undefined;
}

export interface EmailLinkDeps {
  /** FLAG_CUSTOMER_EMAIL. When off, no customer email is sent, however the action is reached. */
  enabled: boolean;
  /** Supabase's updateUser with an email: attaches it to the signed-in account and sends the link. */
  updateEmail(email: string): Promise<{ error: EmailLinkError | null }>;
  /** Supabase's resend for an email change: sends the link again. */
  resendEmail(email: string): Promise<{ error: EmailLinkError | null }>;
}

export interface EmailLinkSent {
  /** The address the link was sent to, as saved (trimmed, lowercase). */
  email: string;
  /** Seconds before the screen offers "Send the link again". */
  resendAfter: number;
}

/** Supabase's own limits have no retry time to pass on; the screen's wait between sends is a minute. */
const SUPABASE_LIMIT_RETRY_SECONDS = 60;

/** Codes that mean the address belongs to someone else, or cannot be used on this account. */
const TAKEN_CODES: ReadonlySet<string> = new Set([
  "email_exists",
  "email_conflict_identity_not_deletable",
  "identity_already_exists",
  "user_already_exists",
]);

/** Codes that mean the visitor's session is gone. */
const SIGNED_OUT_CODES: ReadonlySet<string> = new Set([
  "bad_jwt",
  "no_authorization",
  "session_expired",
  "session_not_found",
  "user_not_found",
]);

/** Codes that mean email sending is down or misconfigured, not that the visitor did anything wrong. */
const UPSTREAM_CODES: ReadonlySet<string> = new Set([
  "email_address_not_authorized",
  "email_provider_disabled",
  "hook_timeout",
  "hook_timeout_after_retry",
  "request_timeout",
  "unexpected_failure",
]);

function failureFor(error: EmailLinkError): ActionError {
  const code = error.code ?? "";
  if (code === "email_address_invalid") {
    return new ActionError("VALIDATION", "Supabase refused the address as invalid", {
      fieldErrors: { email: [{ key: "validation.emailInvalid" }] },
    });
  }
  // One answer for every reason an address cannot be used, so nobody can learn whose it is (ADD-03 "taken").
  if (TAKEN_CODES.has(code)) {
    return new ActionError("VALIDATION", "The address cannot be used on this account", {
      fieldErrors: { email: [{ key: "validation.emailTaken" }] },
    });
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    return new ActionError("RATE_LIMITED", "Supabase's own email limit was reached", {
      retryAfter: SUPABASE_LIMIT_RETRY_SECONDS,
    });
  }
  if (SIGNED_OUT_CODES.has(code)) {
    return new ActionError("UNAUTHENTICATED", "The session was refused when adding an email");
  }
  const upstream = UPSTREAM_CODES.has(code) || (error.status ?? 0) >= 500;
  // Only the error code is kept: it is safe to log, and nothing here can name the address.
  return new ActionError(
    upstream ? "UPSTREAM_FAILED" : "INTERNAL",
    `Supabase could not send the email link (${error.code ?? "no code"})`,
  );
}

/** Customer email is switched off (FLAG_CUSTOMER_EMAIL=0): answer as if the feature does not exist, and send nothing. */
function requireEnabled(deps: EmailLinkDeps): void {
  if (!deps.enabled) {
    throw new ActionError("NOT_FOUND", "Customer email is switched off (FLAG_CUSTOMER_EMAIL)");
  }
}

/**
 * Attaches the email to the signed-in account and has Supabase send the single-use link. Nothing is
 * marked verified here: that happens only when the link is followed (FR-AUTH-02).
 */
export async function addEmailAddress(
  deps: EmailLinkDeps,
  input: AddEmailInput,
): Promise<EmailLinkSent> {
  requireEnabled(deps);
  const { error } = await deps.updateEmail(input.email);
  if (error) throw failureFor(error);
  return { email: input.email, resendAfter: RESEND_AFTER_SECONDS };
}

/** Sends the link again. A newer link replaces the older one, as the screen tells the visitor. */
export async function resendEmailAddress(
  deps: EmailLinkDeps,
  input: AddEmailInput,
): Promise<EmailLinkSent> {
  requireEnabled(deps);
  const { error } = await deps.resendEmail(input.email);
  if (error) throw failureFor(error);
  return { email: input.email, resendAfter: RESEND_AFTER_SECONDS };
}
