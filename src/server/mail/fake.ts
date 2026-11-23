import type { MailMessage, MailSender } from "./types";

/** A sender that sends nothing and remembers what it was asked to send, for tests and local work. */
export interface FakeMailSender extends MailSender {
  readonly sent: readonly MailMessage[];
}

export function createFakeMailSender(options: { failWith?: Error } = {}): FakeMailSender {
  const sent: MailMessage[] = [];
  return {
    sent,
    send(message) {
      if (options.failWith) return Promise.reject(options.failWith);
      sent.push({ to: message.to, subject: message.subject, text: message.text });
      return Promise.resolve();
    },
  };
}

/** The sender used when no mail should go out (no key, or a developer's machine): a message is accepted and dropped. */
export function createNoopMailSender(): MailSender {
  return { send: () => Promise.resolve() };
}
