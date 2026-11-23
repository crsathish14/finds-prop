import { ActionError } from "../actions/normalise-error";
import { MAIL_TIMEOUT_MS, type MailSender } from "./types";

/**
 * Resend through its HTTP API (ADR-181): one POST to /emails with the account key in the Authorization header,
 * the sender, one recipient, the subject, the plain text and the reply-to address. No package is used.
 *
 * What the service answers (its documented behaviour): HTTP 200 with `{ "id": "..." }` when it took the mail,
 * and an error status with `{ "name": "...", "message": "..." }` when it did not. The `message` can repeat the
 * address, so it is never read; the `name` is a short snake_case word (`validation_error`,
 * `rate_limit_exceeded`, `daily_quota_exceeded`, ...) and is repeated only when it has exactly that shape. The
 * free plan has a daily quota, so telling that case apart in the operator's log is useful.
 *
 * The call is cut off after `MAIL_TIMEOUT_MS`, redirects are not followed, and nothing thrown here contains
 * the key, the address, the subject or the text (R-BE-10).
 */
const ENDPOINT = "https://api.resend.com/emails";
/** A provider error name is short snake_case; anything else is not repeated. */
const ERROR_NAME = /^[a-z][a-z_]{1,60}$/;

export interface ResendOptions {
  apiKey: string;
  /** The sender address, for example `no-reply@findsprop.com` (a verified domain in Resend). */
  from: string;
  /** Where a reply goes, for example `support@findsprop.com`. Left out when not set. */
  replyTo?: string | undefined;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createResendSender(options: ResendOptions): MailSender {
  const send = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? MAIL_TIMEOUT_MS;
  return {
    async send(message) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      // The cut-off covers the body too, so a slow answer cannot hold the caller past its budget.
      let status: number;
      let body: string;
      try {
        const response = await send(ENDPOINT, {
          method: "POST",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: options.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(options.replyTo ? { reply_to: options.replyTo } : {}),
          }),
        });
        status = response.status;
        body = response.ok ? "" : await response.text();
      } catch {
        throw new ActionError("UPSTREAM_FAILED", "The mail provider did not answer in time");
      } finally {
        clearTimeout(timer);
      }

      if (status >= 200 && status < 300) return;
      throw new ActionError(
        "UPSTREAM_FAILED",
        `The mail provider refused the message (HTTP ${status}${errorNameFrom(body)})`,
      );
    },
  };
}

/** `: name` when the error body carries a short snake_case name, otherwise nothing. */
function errorNameFrom(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "name" in parsed) {
      const name = (parsed as { name: unknown }).name;
      if (typeof name === "string" && ERROR_NAME.test(name)) return `, ${name}`;
    }
  } catch {
    // Not JSON: say only the status.
  }
  return "";
}
