import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "../messages/en.json";
import { ERROR_CODES } from "@/types/action";
import { failureText, fieldErrorText, type Translator } from "../failure-text";

const translate = createTranslator({ locale: "en", messages }) as unknown as Translator;

describe("UT-failure-text: codes and keys become English from en.json", () => {
  it("every error code has a message", () => {
    for (const code of ERROR_CODES) {
      expect(failureText(translate, { code }).length).toBeGreaterThan(0);
      expect(translate.has(`errors.${code}`)).toBe(true);
    }
  });

  it("a rate limit with a wait time says how many minutes, with the right plural", () => {
    expect(failureText(translate, { code: "RATE_LIMITED", retryAfter: 30 })).toBe(
      "Too many attempts. Please try again in 1 minute.",
    );
    expect(failureText(translate, { code: "RATE_LIMITED", retryAfter: 301 })).toBe(
      "Too many attempts. Please try again in 6 minutes.",
    );
  });

  it("a rate limit without a wait time uses the plain message", () => {
    expect(failureText(translate, { code: "RATE_LIMITED" })).toBe(
      "Too many attempts. Please try again shortly.",
    );
  });

  it("field errors fill in their values and pluralise", () => {
    expect(fieldErrorText(translate, { key: "validation.tooShort", values: { minimum: 1 } })).toBe(
      "Use at least 1 character.",
    );
    expect(fieldErrorText(translate, { key: "validation.tooShort", values: { minimum: 6 } })).toBe(
      "Use at least 6 characters.",
    );
    expect(fieldErrorText(translate, { key: "validation.tooBig", values: { maximum: 4 } })).toBe(
      "Enter a value of 4 or less.",
    );
  });

  it("an unknown key falls back to the generic invalid message instead of showing a key", () => {
    expect(fieldErrorText(translate, { key: "validation.doesNotExist" })).toBe(
      "This value is not valid.",
    );
  });
});
