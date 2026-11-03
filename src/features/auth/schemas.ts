import { z } from "zod";
import { classifyPhoneInput } from "@/lib/phone";

const PHONE_INVALID = "validation.phoneInvalid";
const CAPTCHA_FAILED = "validation.captchaFailed";

/**
 * What the phone sign-in form sends: the number as typed and the token the human-check widget
 * produced. The number is checked here and comes out as +91XXXXXXXXXX, so the rate limit counts the
 * same number however it was typed. A number from another country is refused here, before any
 * code is requested (FR-AUTH-09). A missing token is the same refusal as a bad one.
 */
export const sendPhoneCodeSchema = z.object({
  phone: z
    .string({ error: PHONE_INVALID })
    .max(40, { error: PHONE_INVALID })
    .transform((typed, context) => {
      const checked = classifyPhoneInput(typed);
      if (checked.kind === "valid") return checked.e164;
      context.issues.push({
        code: "custom",
        input: typed,
        message: checked.kind === "unsupported" ? "validation.phoneUnsupported" : PHONE_INVALID,
      });
      return z.NEVER;
    }),
  captchaToken: z
    .string({ error: CAPTCHA_FAILED })
    .min(1, { error: CAPTCHA_FAILED })
    .max(2048, { error: CAPTCHA_FAILED }),
});

export type SendPhoneCodeInput = z.infer<typeof sendPhoneCodeSchema>;
