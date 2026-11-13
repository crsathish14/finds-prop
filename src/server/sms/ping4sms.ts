import { ActionError } from "../actions/normalise-error";
import type { SmsSender } from "./types";

/**
 * Ping4SMS through its HTTP API: one GET to /api/smsapi with the account key, the route, the DLT
 * sender, the DLT template id, the ten digit number and the full message text (ADR-126).
 *
 * What the live service was seen to do (11 Nov 2026, demo account, HTTPS): HTTP 200 with a plain
 * text body that is only a number. A message id (nine digits was seen) means the gateway accepted
 * the message; a short number is an error code (101 for a wrong key; 101 to 110 are in Ping4SMS's
 * own list, below). There is no JSON. So the body decides, and only a long number counts as
 * success: anything else fails closed.
 *
 * India requires the text to be the DLT-registered template with its variable filled in, so the
 * template (with one `{#var#}` where the code goes) is configuration, not code.
 *
 * The account key travels in the address, so the address is never logged, never put in an error,
 * and redirects are not followed. Supabase gives the whole hook 5 seconds including retries, so
 * the call is cut off at 3. Nothing thrown here contains the phone, the code, the key or the text
 * (R-BE-10).
 */
const ENDPOINT = "https://site.ping4sms.com/api/smsapi";
const DEFAULT_TIMEOUT_MS = 3000;
const VARIABLE = "{#var#}";
/** A message id is long (nine digits seen); an error code is short (101 seen). */
const MESSAGE_ID = /^\d{7,}$/;
const ERROR_CODE = /^\d{1,6}$/;
/**
 * What Ping4SMS's own documentation says each error number means (101 was also seen live, for a wrong
 * key). The words are ours and say nothing about the message, the number or the key, so they are safe
 * to log and to show in the operator's log line. A number that is not in the list is reported as its
 * code only.
 */
const PROVIDER_CODES: Readonly<Record<string, string>> = {
  "101": "invalid account key",
  "102": "invalid sender ID",
  "103": "invalid number",
  "104": "invalid route",
  "105": "invalid message",
  "106": "blocked as spam",
  "107": "blocked on a promotional route",
  "108": "low credits on the route",
  "109": "the promotional route is closed at this hour",
  "110": "invalid DLT template ID",
};
/** Our hook passes 91 and the ten digit mobile number. */
const INDIAN_NUMBER = /^91([6-9]\d{9})$/;

export interface Ping4SmsOptions {
  apiKey: string;
  /** The DLT sender id (six letters). */
  senderId: string;
  /** The DLT template id. */
  templateId: string;
  /** Ping4SMS route number; 2 is what their examples use for DLT traffic. */
  route: string;
  /** The DLT template text with `{#var#}` where the code goes, exactly as registered. */
  message: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Checked when the sender is made, so a wrong template fails at the first request, not silently. */
export function assertTemplateHasOneVariable(message: string): void {
  if (message.split(VARIABLE).length !== 2) {
    throw new ActionError(
      "INTERNAL",
      "The SMS provider is not configured (PING4SMS_MESSAGE needs exactly one {#var#})",
    );
  }
}

export function createPing4SmsSender(options: Ping4SmsOptions): SmsSender {
  assertTemplateHasOneVariable(options.message);
  const send = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async sendOtp({ phone, code }) {
      const mobile = INDIAN_NUMBER.exec(phone)?.[1];
      if (!mobile) {
        throw new ActionError("UPSTREAM_FAILED", "The SMS provider cannot send to this number");
      }

      const address = new URL(ENDPOINT);
      address.searchParams.set("key", options.apiKey);
      address.searchParams.set("route", options.route);
      address.searchParams.set("sender", options.senderId);
      address.searchParams.set("number", mobile);
      address.searchParams.set(
        "sms",
        options.message.replace(VARIABLE, () => code),
      );
      address.searchParams.set("templateid", options.templateId);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      // The cut-off covers the body too, so a slow answer cannot hold the hook past its budget.
      let status: number;
      let body: string;
      try {
        const response = await send(address, {
          method: "GET",
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
        status = response.status;
        body = (await response.text()).trim();
      } catch {
        throw new ActionError("UPSTREAM_FAILED", "The SMS provider did not answer in time");
      } finally {
        clearTimeout(timer);
      }

      if (status !== 200) {
        throw new ActionError("UPSTREAM_FAILED", `The SMS provider answered HTTP ${status}`);
      }
      if (MESSAGE_ID.test(body)) return;
      // The body is the provider's text, so only a short plain number is repeated, as a code, with
      // our own words for it when Ping4SMS documents it.
      if (!ERROR_CODE.test(body)) {
        throw new ActionError("UPSTREAM_FAILED", "The SMS provider refused the message");
      }
      const meaning = PROVIDER_CODES[body];
      throw new ActionError(
        "UPSTREAM_FAILED",
        `The SMS provider refused the message (code ${body}${meaning ? `: ${meaning}` : ""})`,
      );
    },
  };
}
