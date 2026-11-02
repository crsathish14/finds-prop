import { describe, expect, it } from "vitest";
import { AUTH_CALLBACK_PATH, hasNoLanguage } from "@/lib/url/language-free";

describe("UT-language-free: paths proxy.ts leaves to their route (S3-T10)", () => {
  it("leaves the API and the sign-in callback alone", () => {
    expect(hasNoLanguage("/api/health")).toBe(true);
    expect(hasNoLanguage("/api/auth/hooks/send-sms")).toBe(true);
    expect(hasNoLanguage(AUTH_CALLBACK_PATH)).toBe(true);
    expect(hasNoLanguage("/auth/callback")).toBe(true);
  });

  it("still routes every page by language", () => {
    expect(hasNoLanguage("/")).toBe(false);
    expect(hasNoLanguage("/auth")).toBe(false);
    expect(hasNoLanguage("/auth/callbacks")).toBe(false);
    expect(hasNoLanguage("/auth/callback/extra")).toBe(false);
    expect(hasNoLanguage("/builder/login")).toBe(false);
    expect(hasNoLanguage("/apiary")).toBe(false);
  });
});
