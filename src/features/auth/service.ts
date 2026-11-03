import { ActionError } from "@/server/actions/normalise-error";
import { RESEND_AFTER_SECONDS } from "./constants";
import type { SendPhoneCodeInput, VerifyPhoneCodeInput } from "./schemas";

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
  /** Supabase's verifyOtp, through the same client: a good code puts the session in the visitor's cookies. */
  verifyOtp(credentials: { phone: string; token: string; type: "sms" }): Promise<{
    data: { session: object | null; user: { id: string } | null };
    error: PhoneCodeError | null;
  }>;
  /** The signed-in user's own profile name, or null when it could not be read. */
  readProfileName(userId: string): Promise<{ fullName: string | null } | null>;
}

export interface PhoneCodeSent {
  /** Seconds before the screen offers "Send a new code". */
  resendAfter: number;
}

/** Supabase's own limits have no retry time to pass on; its minimum gap between codes is a minute. */
const SUPABASE_LIMIT_RETRY_SECONDS = 60;

/** Codes that mean the SMS side is down or misconfigured, not that the visitor did anything wrong. */
const UPSTREAM_CODES: ReadonlySet<string> = new Set([
  "sms_send_failed",
  "hook_timeout",
  "hook_timeout_after_retry",
  "phone_provider_disabled",
  "otp_disabled",
  "request_timeout",
  "unexpected_failure",
]);

function isSupabaseLimit(error: PhoneCodeError): boolean {
  return error.code === "over_sms_send_rate_limit" || error.code === "over_request_rate_limit";
}

function otherFailure(error: PhoneCodeError, what: string): ActionError {
  const upstream =
    (error.code !== undefined && UPSTREAM_CODES.has(error.code)) || (error.status ?? 0) >= 500;
  // Only the error code is kept: it is safe to log, and nothing here can name the number.
  return new ActionError(
    upstream ? "UPSTREAM_FAILED" : "INTERNAL",
    `Supabase could not ${what} (${error.code ?? "no code"})`,
  );
}

function sendFailureFor(error: PhoneCodeError): ActionError {
  if (error.code === "captcha_failed") {
    return new ActionError("VALIDATION", "Supabase refused the human-check token", {
      fieldErrors: { captchaToken: [{ key: "validation.captchaFailed" }] },
    });
  }
  if (isSupabaseLimit(error)) {
    return new ActionError("RATE_LIMITED", "Supabase's own send limit was reached", {
      retryAfter: SUPABASE_LIMIT_RETRY_SECONDS,
    });
  }
  return otherFailure(error, "send the sign-in code");
}

function verifyFailureFor(error: PhoneCodeError): ActionError {
  // Supabase uses one code for a wrong code and for an expired one; the screen tells them apart by
  // how long ago the code was asked for.
  if (error.code === "otp_expired") {
    return new ActionError("VALIDATION", "Supabase refused the code", {
      fieldErrors: { code: [{ key: "validation.codeWrong" }] },
    });
  }
  if (isSupabaseLimit(error)) {
    return new ActionError("RATE_LIMITED", "Supabase's own request limit was reached", {
      retryAfter: SUPABASE_LIMIT_RETRY_SECONDS,
    });
  }
  return otherFailure(error, "check the sign-in code");
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
  if (error) throw sendFailureFor(error);
  return { resendAfter: RESEND_AFTER_SECONDS };
}

/**
 * Checks the six digits. On success Supabase has put the session in the visitor's cookies, and the
 * database has created the profile and the customer role for a new number (BR-02, BR-03). A "success"
 * with no session is treated as a failure: nobody is told they are signed in when they are not.
 * `needsName` is true when the profile has no name yet, which is the case for a new account: the
 * screen then asks for it before going on (ADD-04). If the profile cannot be read the visitor is not
 * held up: the name is asked for again before posting or enquiring anyway.
 */
export async function confirmPhoneCode(
  deps: PhoneCodeDeps,
  input: VerifyPhoneCodeInput,
): Promise<{ signedIn: true; needsName: boolean }> {
  const { data, error } = await deps.verifyOtp({
    phone: input.phone,
    token: input.code,
    type: "sms",
  });
  if (error) throw verifyFailureFor(error);
  if (!data.session) {
    throw new ActionError("INTERNAL", "Supabase accepted the code but returned no session");
  }
  const profile = data.user ? await deps.readProfileName(data.user.id) : null;
  return { signedIn: true, needsName: profile !== null && !profile.fullName };
}
