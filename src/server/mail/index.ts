import { createAllowlistMailSender, parseMailAllowlist } from "./allowlist";
import { createNoopMailSender } from "./fake";
import { createResendSender } from "./resend";
import type { MailSender } from "./types";

export { createAllowlistMailSender, isMailAllowed, parseMailAllowlist } from "./allowlist";
export { createFakeMailSender, createNoopMailSender, type FakeMailSender } from "./fake";
export {
  NOTIFICATION_KINDS,
  silentNotifier,
  type NotificationEvent,
  type NotificationKind,
  type Notifier,
} from "./events";
export { createResendSender, type ResendOptions } from "./resend";
export * from "./render-template";
export { MAIL_TIMEOUT_MS, type MailMessage, type MailSender } from "./types";

export interface MailConfig {
  APP_ENV: "local" | "dev" | "staging" | "production";
  /** The Resend key. Without it no mail is sent, in any environment. */
  RESEND_API_KEY?: string | undefined;
  /** The sender address on the verified domain. */
  MAIL_FROM: string;
  /** Where a reply goes. */
  MAIL_REPLY_TO?: string | undefined;
  /** Comma separated addresses (or `@domain` entries) that dev and staging may mail. */
  MAIL_DEV_ALLOWLIST?: string | undefined;
}

/**
 * The sender for this environment (ADR-181, which replaces the "no provider yet" rule of ADR-074).
 *
 * - No Resend key: the sender that drops the message, in every environment. Unlike the SMS sender this never
 *   refuses: a code that cannot be sent locks a person out, a notification that is not sent costs nothing they
 *   were promised, so a deployment without a key still works.
 * - `local`: always the sender that drops the message, even with a key, so a developer's machine never mails.
 * - `dev` and `staging`: Resend, but only to the addresses in `MAIL_DEV_ALLOWLIST` (an empty list mails nobody),
 *   because these share the domain and the daily allowance with production and hold test data.
 * - `production`: Resend, to whoever the message is for.
 *
 * `onSkip` is told when the allowlist drops a message, with no address or text, so the caller can log it.
 */
export function chooseMailSender(
  config: MailConfig,
  options: { fetchImpl?: typeof fetch; onSkip?: () => void } = {},
): MailSender {
  if (config.APP_ENV === "local" || !config.RESEND_API_KEY) return createNoopMailSender();
  const resend = createResendSender({
    apiKey: config.RESEND_API_KEY,
    from: config.MAIL_FROM,
    replyTo: config.MAIL_REPLY_TO,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  if (config.APP_ENV === "production") return resend;
  return createAllowlistMailSender(
    resend,
    parseMailAllowlist(config.MAIL_DEV_ALLOWLIST),
    options.onSkip,
  );
}
