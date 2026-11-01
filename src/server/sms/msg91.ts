import { ActionError } from "../actions/normalise-error";
import type { SmsSender } from "./types";

/**
 * MSG91 through its v5 Send OTP API (POST /api/v5/otp, `authkey` header, `template_id`, `mobile`
 * and our own six digit `otp`, so the code Supabase made is the code that is sent). India requires
 * the template to be registered with DLT; until it is approved this cannot send. The shape of the
 * request and of MSG91's answer comes from third-party client libraries, not MSG91's own reference
 * (which could not be read), and has not been run against the live service.
 *
 * Supabase gives the whole hook 5 seconds including retries, so this call is cut off at 3. Nothing
 * thrown here contains the phone, the code or the key (R-BE-10).
 */
const ENDPOINT = "https://control.msg91.com/api/v5/otp";
const DEFAULT_TIMEOUT_MS = 3000;

export interface Msg91Options {
  authKey: string;
  templateId: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function createMsg91Sender(options: Msg91Options): SmsSender {
  const send = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async sendOtp({ phone, code }) {
      const address = new URL(ENDPOINT);
      address.searchParams.set("template_id", options.templateId);
      address.searchParams.set("mobile", phone);
      address.searchParams.set("otp", code);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await send(address, {
          method: "POST",
          headers: { authkey: options.authKey, "Content-Type": "application/json" },
          body: "{}",
          signal: controller.signal,
        });
      } catch {
        throw new ActionError("UPSTREAM_FAILED", "The SMS provider did not answer in time");
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        throw new ActionError(
          "UPSTREAM_FAILED",
          `The SMS provider answered HTTP ${response.status}`,
        );
      }
      // MSG91 can answer HTTP 200 with {"type":"error"}, so the body decides.
      const answer = (await response.json().catch(() => null)) as { type?: unknown } | null;
      if (!answer || answer.type !== "success") {
        throw new ActionError("UPSTREAM_FAILED", "The SMS provider refused the message");
      }
    },
  };
}
