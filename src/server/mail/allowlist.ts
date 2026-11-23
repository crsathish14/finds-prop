import type { MailMessage, MailSender } from "./types";

/**
 * The list of addresses a non-production deployment may mail (ADR-181). Dev and staging share the one verified
 * domain and the one daily allowance with production, and their data is test data, so a mail goes out only to an
 * address the owner named: an exact address (`tester@example.com`) or a whole domain written with a leading
 * `@` (`@findsprop.com`). The comparison ignores case and surrounding spaces. An empty list allows nobody.
 */
export function parseMailAllowlist(raw: string | undefined): readonly string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function isMailAllowed(address: string, allowlist: readonly string[]): boolean {
  const normal = address.trim().toLowerCase();
  if (!normal.includes("@")) return false;
  const domain = normal.slice(normal.lastIndexOf("@"));
  return allowlist.some((entry) => (entry.startsWith("@") ? entry === domain : entry === normal));
}

/**
 * Wraps a sender so a message to an address that is not on the list is dropped, not sent. `onSkip` is told
 * only that one was dropped (never the address or the text), so the caller can log it without personal data.
 */
export function createAllowlistMailSender(
  inner: MailSender,
  allowlist: readonly string[],
  onSkip?: () => void,
): MailSender {
  return {
    send(message: MailMessage) {
      if (!isMailAllowed(message.to, allowlist)) {
        onSkip?.();
        return Promise.resolve();
      }
      return inner.send(message);
    },
  };
}
