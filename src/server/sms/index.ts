import { ActionError } from "../actions/normalise-error";
import { createFakeSmsSender } from "./fake";
import { createMsg91Sender } from "./msg91";
import type { SmsSender } from "./types";

export type { SmsSender } from "./types";

export interface SmsConfig {
  APP_ENV: "local" | "dev" | "staging" | "production";
  MSG91_AUTH_KEY?: string | undefined;
  MSG91_TEMPLATE_ID?: string | undefined;
}

/**
 * The sender for this environment. With the MSG91 key and template it is the real one. Without
 * them, local and dev use a fake that sends nothing (developers sign in with Supabase's test
 * numbers), but staging and production refuse: a deployment that cannot send codes must say so
 * loudly, not pretend (fail closed).
 */
export function chooseSmsSender(config: SmsConfig, fetchImpl?: typeof fetch): SmsSender {
  if (config.MSG91_AUTH_KEY && config.MSG91_TEMPLATE_ID) {
    return createMsg91Sender({
      authKey: config.MSG91_AUTH_KEY,
      templateId: config.MSG91_TEMPLATE_ID,
      ...(fetchImpl ? { fetchImpl } : {}),
    });
  }
  if (config.APP_ENV === "local" || config.APP_ENV === "dev") return createFakeSmsSender();
  throw new ActionError("INTERNAL", "The SMS provider is not configured");
}
