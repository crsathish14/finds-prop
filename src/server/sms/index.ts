import { ActionError } from "../actions/normalise-error";
import { createFakeSmsSender } from "./fake";
import { createMsg91Sender } from "./msg91";
import { createPing4SmsSender } from "./ping4sms";
import type { SmsSender } from "./types";

export type { SmsSender } from "./types";

export interface SmsConfig {
  APP_ENV: "local" | "dev" | "staging" | "production";
  /** Which provider sends; Ping4SMS when not set (ADR-126). */
  SMS_PROVIDER?: "ping4sms" | "msg91" | undefined;
  PING4SMS_API_KEY?: string | undefined;
  PING4SMS_SENDER_ID?: string | undefined;
  PING4SMS_TEMPLATE_ID?: string | undefined;
  PING4SMS_ROUTE?: string | undefined;
  PING4SMS_MESSAGE?: string | undefined;
  MSG91_AUTH_KEY?: string | undefined;
  MSG91_TEMPLATE_ID?: string | undefined;
}

/**
 * The sender for this environment. With the chosen provider fully set up it is the real one.
 * Without that, local and dev use a fake that sends nothing (developers sign in with Supabase's
 * test numbers), but staging and production refuse: a deployment that cannot send codes must say
 * so loudly, not pretend (fail closed). A half-set-up provider counts as not set up.
 */
export function chooseSmsSender(config: SmsConfig, fetchImpl?: typeof fetch): SmsSender {
  const withFetch = fetchImpl ? { fetchImpl } : {};
  if (config.SMS_PROVIDER === "msg91") {
    if (config.MSG91_AUTH_KEY && config.MSG91_TEMPLATE_ID) {
      return createMsg91Sender({
        authKey: config.MSG91_AUTH_KEY,
        templateId: config.MSG91_TEMPLATE_ID,
        ...withFetch,
      });
    }
  } else if (
    config.PING4SMS_API_KEY &&
    config.PING4SMS_SENDER_ID &&
    config.PING4SMS_TEMPLATE_ID &&
    config.PING4SMS_MESSAGE
  ) {
    return createPing4SmsSender({
      apiKey: config.PING4SMS_API_KEY,
      senderId: config.PING4SMS_SENDER_ID,
      templateId: config.PING4SMS_TEMPLATE_ID,
      route: config.PING4SMS_ROUTE ?? "2",
      message: config.PING4SMS_MESSAGE,
      ...withFetch,
    });
  }
  if (config.APP_ENV === "local" || config.APP_ENV === "dev") return createFakeSmsSender();
  throw new ActionError("INTERNAL", "The SMS provider is not configured");
}
