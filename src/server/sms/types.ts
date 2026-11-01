/**
 * Sending a phone code goes through one interface (R-BE-09). Features and the sign-in hook never
 * call a provider directly; a fake exists for tests and for local work.
 */
export interface SmsSender {
  /** `phone` is digits only with the country code, such as 919000000001. `code` is six digits. */
  sendOtp(message: { phone: string; code: string }): Promise<void>;
}
