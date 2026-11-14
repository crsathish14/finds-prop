import { env } from "@/server/env";
import { createLogger } from "@/server/logger";
import { reportError } from "@/server/observability";
import { readRequestId } from "@/server/request-id";
import { chooseSmsSender } from "@/server/sms";
import { handleSendSmsHook } from "@/server/sms/send-sms-hook";

/**
 * Called by Supabase Auth to send a phone code. Machine caller: verified by signature, never by
 * cookie or session. All logic is in server/sms/send-sms-hook.ts. POST only (the framework answers
 * 405 to any other method).
 */
export async function POST(request: Request) {
  const requestId = readRequestId(request.headers) ?? crypto.randomUUID();
  return handleSendSmsHook(request, {
    secret: env.SEND_SMS_HOOK_SECRET,
    getSender: () => chooseSmsSender(env),
    nowSeconds: Math.floor(Date.now() / 1000),
    log: createLogger().child({ requestId, route: "send-sms-hook" }),
    reportError: (error, context) => reportError(error, { ...context, requestId }),
  });
}
