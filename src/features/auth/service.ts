import { ActionError } from "@/server/actions/normalise-error";
import { RESEND_AFTER_SECONDS } from "./constants";
import type { SendPhoneCodeInput } from "./schemas";

/** What the service reads from a Supabase auth error. The message is never read: it can repeat the number. */
export interface PhoneCodeError {
  code?: string | undefined;
  status?: number | undefined;
}

export interface PhoneCodeDeps {
  /** Supabase's signInWithOtp, reached through the cookie-bound server client. */
  signInWithOtp(credentials: {
    phone: string;
    options: { captchaToken: string; shouldCreateUser: boolean };
  }): Promise<{ error: PhoneCodeError | null }>;
}

export interface PhoneCodeSent {
  /** Seconds before the screen offers "Send a new code". */
  resendAfter: number;
}

/** Supabase's own send limit has no retry time to pass on; its minimum gap between codes is a minute. */
const SUPABASE_LIMIT_RETRY_SECONDS = 60;

/** Codes that mean the SMS side is down or misconfigured, not that the visitor did anything wrong. */
const UPSTREAM_CODES: ReadonlySet<string> = new Set([
  "sms_send_failed",
  "hook_timeout",
  "hook_timeout_after_retry",
  "phone_provider_disabled",
  "request_timeout",
  "unexpected_failure",
]);

function failureFor(error: PhoneCodeError): ActionError {
  if (error.code === "captcha_failed") {
    return new ActionError("VALIDATION", "Supabase refused the human-check token", {
      fieldErrors: { captchaToken: [{ key: "validation.captchaFailed" }] },
    });
  }
  if (error.code === "over_sms_send_rate_limit" || error.code === "over_request_rate_limit") {
    return new ActionError("RATE_LIMITED", "Supabase's own send limit was reached", {
      retryAfter: SUPABASE_LIMIT_RETRY_SECONDS,
    });
  }
  const upstream =
    (error.code !== undefined && UPSTREAM_CODES.has(error.code)) || (error.status ?? 0) >= 500;
  // Only the error code is kept: it is safe to log, and nothing here can name the number.
  return new ActionError(
    upstream ? "UPSTREAM_FAILED" : "INTERNAL",
    `Supabase could not send the sign-in code (${error.code ?? "no code"})`,
  );
}

/**
 * Asks Supabase to text a sign-in code. One flow for both cases: a number Supabase has not seen yet
 * becomes a new account when the code is entered (BR-02, BR-03), so the answer never tells anyone
 * whether a number already has an account. Supabase checks the human-check token itself and calls
 * our Send SMS hook, which sends through MSG91.
 */
export async function requestPhoneCode(
  deps: PhoneCodeDeps,
  input: SendPhoneCodeInput,
): Promise<PhoneCodeSent> {
  const { error } = await deps.signInWithOtp({
    phone: input.phone,
    options: { captchaToken: input.captchaToken, shouldCreateUser: true },
  });
  if (error) throw failureFor(error);
  return { resendAfter: RESEND_AFTER_SECONDS };
}
