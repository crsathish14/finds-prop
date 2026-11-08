/**
 * Sending a notification mail goes through one interface (R-BE-09, DEC-27, S6-T07). Features never call a mail
 * provider directly; a fake exists for tests and local work. Nothing uses this yet: the dashboard is the only
 * place an owner is told anything in v1, and mail on an enquiry or an approval is a post-launch decision. The
 * interface and the event names are here so that adding a provider later is one adapter and a few calls, not a
 * change in every action.
 */

/** How long an implementation may take before it gives up, in milliseconds (the same budget as the SMS adapter). */
export const MAIL_TIMEOUT_MS = 3000;

/** One plain-text message to one address. The words are already in the reader's language; no HTML. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailSender {
  /**
   * Sends the message, or throws an `ActionError("UPSTREAM_FAILED")` that says nothing about the address or
   * the text (R-BE-10). An implementation gives up after `MAIL_TIMEOUT_MS`.
   */
  send(message: MailMessage): Promise<void>;
}
