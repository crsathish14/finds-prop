import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "@/lib/public-env";
import { isDesignLabEnabled, parseServerEnv } from "@/server/env";

describe("UT-env: the Design Lab switch (ADR-020)", () => {
  it.each([
    [{}, false],
    [{ DESIGN_LAB: "1" }, true],
    [{ DESIGN_LAB: "1", APP_ENV: "dev" }, true],
    [{ DESIGN_LAB: "1", APP_ENV: "staging" }, true],
    [{ DESIGN_LAB: "1", APP_ENV: "production" }, false],
    [{ DESIGN_LAB: "0", APP_ENV: "dev" }, false],
  ])("%j gives %s", (settings, expected) => {
    expect(isDesignLabEnabled(parseServerEnv(settings))).toBe(expected);
  });
});

describe("UT-env: server environment", () => {
  it("applies safe defaults: local environment, every flag off", () => {
    const env = parseServerEnv({});
    expect(env.APP_ENV).toBe("local");
    expect(env.FLAG_AI_SEARCH).toBe(false);
    expect(env.FLAG_MAP_VIEW).toBe(false);
    expect(env.FLAG_PG_LISTINGS).toBe(false);
    expect(env.FLAG_CUSTOMER_EMAIL).toBe(false);
    expect(env.DESIGN_LAB).toBe(false);
  });

  it("turns flags on only for 1 or true", () => {
    expect(parseServerEnv({ FLAG_MAP_VIEW: "1" }).FLAG_MAP_VIEW).toBe(true);
    expect(parseServerEnv({ FLAG_MAP_VIEW: "true" }).FLAG_MAP_VIEW).toBe(true);
    expect(parseServerEnv({ FLAG_MAP_VIEW: "0" }).FLAG_MAP_VIEW).toBe(false);
    expect(() => parseServerEnv({ FLAG_MAP_VIEW: "yes" })).toThrow(/FLAG_MAP_VIEW/);
  });

  it("treats a blank value as not provided", () => {
    expect(
      parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "" }).SUPABASE_SERVICE_ROLE_KEY,
    ).toBeUndefined();
  });

  it("rejects an unknown environment name and names the variable, never its value", () => {
    const secret = "do-not-print-this-value";
    expect(() => parseServerEnv({ APP_ENV: secret })).toThrow(/APP_ENV/);
    try {
      parseServerEnv({ APP_ENV: secret });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });

  it("requires a long enough rate-limit secret when one is given", () => {
    expect(() => parseServerEnv({ RATE_LIMIT_HMAC_SECRET: "short" })).toThrow(
      /RATE_LIMIT_HMAC_SECRET/,
    );
    expect(
      parseServerEnv({ RATE_LIMIT_HMAC_SECRET: "x".repeat(32) }).RATE_LIMIT_HMAC_SECRET,
    ).toHaveLength(32);
  });
});

describe("UT-env: public environment", () => {
  const valid = {
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "placeholder",
  };

  it("accepts the required variables and leaves optional ones undefined", () => {
    const env = parsePublicEnv(valid);
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBeUndefined();
  });

  it("fails fast listing the missing or malformed names", () => {
    expect(() => parsePublicEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not a url" })).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
    expect(() => parsePublicEnv({})).toThrow(
      /NEXT_PUBLIC_SITE_URL.*NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("never echoes a bad value", () => {
    try {
      parsePublicEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "bad value with spaces" });
    } catch (error) {
      expect(String(error)).not.toContain("bad value with spaces");
    }
  });
});
