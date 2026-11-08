import { createNoopMailSender } from "./fake";
import type { MailSender } from "./types";

export { createFakeMailSender, createNoopMailSender, type FakeMailSender } from "./fake";
export {
  NOTIFICATION_KINDS,
  silentNotifier,
  type NotificationEvent,
  type NotificationKind,
  type Notifier,
} from "./events";
export { MAIL_TIMEOUT_MS, type MailMessage, type MailSender } from "./types";

/**
 * The sender for this environment. No mail provider is chosen yet (DEC-27: mail on an enquiry or an approval is a
 * post-launch decision), so every environment gets the sender that drops the message. Unlike the SMS sender this
 * does not refuse in production: a code that cannot be sent locks a person out, a notification that is not sent
 * costs nothing they were promised. When a provider is added it is chosen here, from `src/server/env.ts`.
 */
export function chooseMailSender(): MailSender {
  return createNoopMailSender();
}
