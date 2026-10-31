import type { ActionFailure, FieldError } from "@/types/action";

/**
 * Turns the codes and keys an action returns into words (ADR-035). The server never sends
 * sentences; every screen shows these. Works with the translator from `useTranslations()` in
 * components and from `getTranslations()` in server components.
 */
export interface Translator {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
}

export function failureText(
  t: Translator,
  failure: Pick<ActionFailure, "code" | "retryAfter">,
): string {
  if (failure.code === "RATE_LIMITED" && failure.retryAfter !== undefined) {
    return t("errors.RATE_LIMITED_WAIT", {
      minutes: Math.max(1, Math.ceil(failure.retryAfter / 60)),
    });
  }
  return t(`errors.${failure.code}`);
}

export function fieldErrorText(t: Translator, error: FieldError): string {
  return t.has(error.key) ? t(error.key, error.values) : t("validation.invalid");
}
