import { z } from "zod";
import { classifyError } from "../actions/normalise-error";
import type { Logger } from "../logger";
import { verifyStandardWebhook } from "../webhooks/standard-webhooks";
import type { SmsSender } from "./types";

/**
 * The Supabase "Send SMS" hook (ADR-010, plan 06 section 12). Supabase makes the six digit code and
 * calls this to send it. Order, as for every webhook (R-BE-13): check the signature first, ignore
 * cookies, say nothing useful to a caller that fails the check, and never log the phone or the code
 * (R-BE-10). Only Indian mobile numbers receive a code (DEC-31).
 *
 * Supabase allows the whole hook 5 seconds including retries, so the provider call is cut at 3.
 */
const PAYLOAD = z.object({
  user: z.object({ phone: z.string() }),
  sms: z.object({ otp: z.string().regex(/^\d{6}$/) }),
});

const INDIAN_MOBILE = /^\+?91([6-9]\d{9})$/;

export interface SendSmsHookDeps {
  /** The hook secret (`v1,whsec_...`); when missing the hook refuses everything. */
  secret: string | undefined;
  getSender(): SmsSender;
  nowSeconds: number;
  log: Logger;
}

const refuse = () => new Response(null, { status: 401 });

/** The error shape Supabase's hooks expect; the message is generic on purpose. */
const hookError = (status: number, message: string) =>
  Response.json({ error: { http_code: status, message } }, { status });

export async function handleSendSmsHook(
  request: Request,
  deps: SendSmsHookDeps,
): Promise<Response> {
  const body = await request.text();

  if (!deps.secret) {
    deps.log.error("send-sms hook secret is not configured");
    return refuse();
  }
  const verdict = verifyStandardWebhook({
    secret: deps.secret,
    nowSeconds: deps.nowSeconds,
    request: {
      id: request.headers.get("webhook-id"),
      timestamp: request.headers.get("webhook-timestamp"),
      signature: request.headers.get("webhook-signature"),
      body,
    },
  });
  if (!verdict.valid) {
    deps.log.warn("send-sms hook request refused", { reason: verdict.reason });
    return refuse();
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return hookError(400, "The request could not be understood.");
  }
  const parsed = PAYLOAD.safeParse(json);
  if (!parsed.success) return hookError(400, "The request could not be understood.");

  const mobile = INDIAN_MOBILE.exec(parsed.data.user.phone)?.[1];
  if (!mobile) {
    deps.log.warn("send-sms hook refused a number outside India");
    return hookError(400, "Only Indian mobile numbers can receive a code.");
  }

  try {
    await deps.getSender().sendOtp({ phone: `91${mobile}`, code: parsed.data.sms.otp });
  } catch (error) {
    deps.log.error("send-sms hook could not send the code", { errorCode: classifyError(error) });
    return hookError(502, "The code could not be sent. Please try again.");
  }
  return Response.json({}, { status: 200, headers: { "Cache-Control": "no-store" } });
}
