/**
 * Indian mobile numbers (FR-AUTH-01: only +91 numbers receive codes). Pure functions, so the form
 * and the server action can share them; the server still validates on its own (R-BE-03).
 */
const MOBILE_DIGITS = 10;

/** Only the digits of what the reader typed or pasted: spaces, dashes and brackets are dropped. */
export function phoneDigits(input: string): string {
  return input.replace(/\D/g, "");
}

/**
 * "98765 43210", "+91 98765-43210", "09876543210" and "919876543210" all become "+919876543210".
 * Returns null when it is not a ten-digit Indian mobile number (which starts with 6, 7, 8 or 9).
 */
export function normaliseIndianMobile(input: string): string | null {
  let digits = phoneDigits(input);
  if (digits.length === MOBILE_DIGITS + 2 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === MOBILE_DIGITS + 1 && digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export type PhoneInputCheck =
  { kind: "valid"; e164: string } | { kind: "invalid" } | { kind: "unsupported" };

const INTERNATIONAL_PREFIX = /^\s*(?:\+|00)/;

/**
 * Tells a mistyped number from a number of another country, because the sign-in screen words them
 * differently (ADD-01). Only a number written with a country code (`+44 …` or `0044 …`) can be
 * "unsupported"; a ten-digit number the field cannot use is "invalid". Every Indian form that
 * normaliseIndianMobile accepts is valid here too, and `0091 …` is accepted as well.
 */
export function classifyPhoneInput(input: string): PhoneInputCheck {
  const international = INTERNATIONAL_PREFIX.exec(input);
  if (!international) {
    const e164 = normaliseIndianMobile(input);
    return e164 ? { kind: "valid", e164 } : { kind: "invalid" };
  }
  const digits = phoneDigits(input.slice(international[0].length));
  if (digits.length === 0) return { kind: "invalid" };
  if (!digits.startsWith("91")) return { kind: "unsupported" };
  const e164 = normaliseIndianMobile(digits);
  return e164 ? { kind: "valid", e164 } : { kind: "invalid" };
}
