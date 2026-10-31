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
