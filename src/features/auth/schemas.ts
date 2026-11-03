import { z } from "zod";
import { classifyPhoneInput } from "@/lib/phone";
import { CODE_LENGTH } from "./constants";

const PHONE_INVALID = "validation.phoneInvalid";
const CODE_INVALID = "validation.codeInvalid";
const CAPTCHA_FAILED = "validation.captchaFailed";

/**
 * The number as typed, checked here and returned as +91XXXXXXXXXX, so the rate limit counts the same
 * number however it was typed. A number from another country is refused here, before any code is
 * requested or checked (FR-AUTH-09).
 */
const phoneField = z
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
  });

/**
 * What the phone sign-in form sends: the number and the token the human-check widget produced. A
 * missing token is the same refusal as a bad one.
 */
export const sendPhoneCodeSchema = z.object({
  phone: phoneField,
  captchaToken: z
    .string({ error: CAPTCHA_FAILED })
    .min(1, { error: CAPTCHA_FAILED })
    .max(2048, { error: CAPTCHA_FAILED }),
});

export type SendPhoneCodeInput = z.infer<typeof sendPhoneCodeSchema>;

/** What the code step sends: the number it sent the code to and the six digits typed. */
export const verifyPhoneCodeSchema = z.object({
  phone: phoneField,
  code: z.string({ error: CODE_INVALID }).regex(new RegExp(`^\\d{${CODE_LENGTH}}$`), {
    error: CODE_INVALID,
  }),
});

export type VerifyPhoneCodeInput = z.infer<typeof verifyPhoneCodeSchema>;
