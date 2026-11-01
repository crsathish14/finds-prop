import type { SmsSender } from "./types";

/** A sender that sends nothing and remembers what it was asked to send, for tests and local work. */
export interface FakeSmsSender extends SmsSender {
  readonly sent: readonly { phone: string; code: string }[];
}

export function createFakeSmsSender(options: { failWith?: Error } = {}): FakeSmsSender {
  const sent: { phone: string; code: string }[] = [];
  return {
    sent,
    sendOtp(message) {
      if (options.failWith) return Promise.reject(options.failWith);
      sent.push({ phone: message.phone, code: message.code });
      return Promise.resolve();
    },
  };
}
