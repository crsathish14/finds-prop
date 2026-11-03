import {
  sendPhoneCodeSchema,
  verifyPhoneCodeSchema,
  type SendPhoneCodeInput,
  type VerifyPhoneCodeInput,
} from "./schemas";

/**
 * How the send-code action runs, kept apart from the "use server" file so a test can build the same
 * action with fake dependencies. The visitor is not signed in yet, so there is no authentication
 * step; the per-phone and per-address limits are what protect it (FR-AUTH-09, DEC-31). The limit is
 * keyed on the normalised number, so "98765 43210" and "+91 9876543210" share one count.
 */
export const sendPhoneCodeConfig = {
  name: "sendPhoneCode",
  input: sendPhoneCodeSchema,
  auth: "none" as const,
  rateLimit: { scope: "otp_request" as const, key: (input: SendPhoneCodeInput) => input.phone },
};

/**
 * Checking a code: also anonymous, limited to 10 tries per phone per hour (DEC-31). Every try counts,
 * right or wrong, so guessing six digits is not possible within the limit.
 */
export const verifyPhoneCodeConfig = {
  name: "verifyPhoneCode",
  input: verifyPhoneCodeSchema,
  auth: "none" as const,
  rateLimit: { scope: "otp_verify" as const, key: (input: VerifyPhoneCodeInput) => input.phone },
};
