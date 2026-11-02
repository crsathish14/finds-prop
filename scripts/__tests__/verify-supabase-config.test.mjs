import { describe, expect, it, vi } from "vitest";
import {
  assertSiteUrl,
  assertRequest,
  CHECKED_FIELDS,
  evaluateSettings,
  fetchAuthSettings,
  GUARD_HOOK_URI,
  pickChecked,
  summarise,
  VerifyRefusal,
} from "../lib/verify-supabase-config-core.mjs";

// Starts like a personal access token (sbp_) but is not shaped like one (40 hex characters), so the
// secret scan does not take a fixture for a leaked credential.
const TOKEN = "sbp_unit-test-token-not-a-real-credential";
const REF = "abcdefghijklmnopqrst";
const SITE = "https://dev.example.test";
const NOW = Date.parse("2026-11-02T12:00:00Z");
const LATER = "2026-11-09T12:00:00Z";

/** What the management API returns for a healthy dev project, secrets included. */
const healthyResponse = {
  external_google_enabled: true,
  external_google_client_id: "client-id-canary",
  external_google_secret: "CANARY-GOOGLE-SECRET",
  external_phone_enabled: true,
  external_anonymous_users_enabled: false,
  disable_signup: false,
  site_url: SITE,
  uri_allow_list: `http://localhost:3000/auth/callback, ${SITE}/auth/callback`,
  hook_before_user_created_enabled: true,
  hook_before_user_created_uri: GUARD_HOOK_URI,
  hook_before_user_created_secrets: "CANARY-GUARD-SECRET",
  hook_send_sms_enabled: false,
  hook_send_sms_uri: null,
  hook_send_sms_secrets: "CANARY-SMS-HOOK-SECRET",
  sms_test_otp: "919000000001=123456",
  sms_test_otp_valid_until: LATER,
  sms_autoconfirm: false,
  sms_twilio_auth_token: "CANARY-TWILIO-TOKEN",
  security_captcha_enabled: false,
  security_captcha_provider: null,
  security_captcha_secret: "CANARY-CAPTCHA-SECRET",
};

const CANARIES = [
  "CANARY-GOOGLE-SECRET",
  "CANARY-GUARD-SECRET",
  "CANARY-SMS-HOOK-SECRET",
  "CANARY-TWILIO-TOKEN",
  "CANARY-CAPTCHA-SECRET",
  "123456",
  TOKEN,
];

/** A healthy staging or production project: everything on, nothing local, no test codes. */
const healthyProduction = {
  ...healthyResponse,
  uri_allow_list: `${SITE}/auth/callback`,
  hook_send_sms_enabled: true,
  hook_send_sms_uri: `${SITE}/api/auth/hooks/send-sms`,
  sms_test_otp: "",
  sms_test_otp_valid_until: null,
  security_captcha_enabled: true,
  security_captcha_provider: "turnstile",
};

const run = (response, environment = "dev", overrides = {}) =>
  evaluateSettings({
    settings: pickChecked({ ...response, ...overrides }),
    environment,
    siteUrl: SITE,
    now: NOW,
  });

const statusOf = (results, id) => results.find((result) => result.id === id).status;

describe("UT-verify-supabase-config: the request is checked before it leaves (S3-T14)", () => {
  it("accepts a personal access token, a project reference and a known environment", () => {
    expect(() => assertRequest({ token: TOKEN, ref: REF, environment: "dev" })).not.toThrow();
  });

  it("refuses a missing token, and anything that is not a personal access token", () => {
    expect(() => assertRequest({ token: undefined, ref: REF, environment: "dev" })).toThrow(
      VerifyRefusal,
    );
    expect(() => assertRequest({ token: "", ref: REF, environment: "dev" })).toThrow(/not set/);
    expect(() =>
      assertRequest({ token: "eyJhbGciOiJIUzI1NiJ9.service.role", ref: REF, environment: "dev" }),
    ).toThrow(/never use a service or secret key/);
  });

  it("refuses a malformed project reference and an unknown environment", () => {
    for (const ref of [
      undefined,
      "",
      "short",
      "ABCDEFGHIJKLMNOPQRST",
      `${REF}x`,
      "abcdefghij.supabase.co",
    ]) {
      expect(() => assertRequest({ token: TOKEN, ref, environment: "dev" })).toThrow(
        /20 lowercase/,
      );
    }
    expect(() => assertRequest({ token: TOKEN, ref: REF, environment: "prod" })).toThrow(
      /dev, staging, production/,
    );
  });

  it("never puts the token in a refusal", () => {
    for (const attempt of [
      () => assertRequest({ token: "eyJ-not-a-pat-0123456789", ref: REF, environment: "dev" }),
      () => assertRequest({ token: TOKEN, ref: "bad", environment: "dev" }),
    ]) {
      try {
        attempt();
      } catch (error) {
        expect(error.message).not.toContain("eyJ-not-a-pat");
        expect(error.message).not.toContain(TOKEN);
      }
    }
  });

  it("accepts the app's address alone, with or without a trailing slash and a port", () => {
    for (const address of [
      "http://localhost:3000",
      "http://localhost:3000/",
      "https://findsprop.example.test",
      "https://dev.findsprop.example.test/",
    ]) {
      expect(() => assertSiteUrl(address)).not.toThrow();
    }
  });

  it.each([
    ["no scheme", "localhost:3000"],
    ["a space on the end", "http://localhost:3000 "],
    ["quotes kept", '"http://localhost:3000"'],
    ["a path", "http://localhost:3000/auth/callback"],
    ["another scheme", "ftp://localhost:3000"],
    ["the next option taken as the value", "--environment"],
    ["no value at all", undefined],
  ])("refuses --site-url with %s, before any request", (_name, address) => {
    expect(() => assertSiteUrl(address)).toThrow(VerifyRefusal);
  });

  it("does not echo what was typed in the refusal", () => {
    try {
      assertSiteUrl("http://user:secret-value@localhost:3000");
    } catch (error) {
      expect(error.message).not.toContain("secret-value");
    }
  });

  it("says a failing dev setting is not as expected yet, not that it is unset", () => {
    const results = run(healthyResponse, "dev", { security_captcha_enabled: false });
    expect(results.find((result) => result.id === "captcha").note).toBe(
      "not as expected yet (allowed on this environment)",
    );
  });
});

describe("UT-verify-supabase-config: reading the settings", () => {
  const respond = (status, body = {}) =>
    vi.fn().mockResolvedValue({ status, json: async () => body });

  it("asks the management API for this project, as a bearer, with a GET", async () => {
    const fetchSpy = respond(200, healthyResponse);
    await fetchAuthSettings({ fetch: fetchSpy, token: TOKEN, ref: REF, environment: "dev" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [address, options] = fetchSpy.mock.calls[0];
    expect(address).toBe(`https://api.supabase.com/v1/projects/${REF}/config/auth`);
    expect(options.method).toBe("GET");
    expect(options.headers.authorization).toBe(`Bearer ${TOKEN}`);
    expect(options.body).toBeUndefined();
  });

  it("keeps only the checked fields and turns the test codes into a yes or no", async () => {
    const settings = await fetchAuthSettings({
      fetch: respond(200, healthyResponse),
      token: TOKEN,
      ref: REF,
      environment: "dev",
    });
    expect(Object.keys(settings).sort()).toEqual([...CHECKED_FIELDS, "sms_test_otp_set"].sort());
    expect(settings.sms_test_otp_set).toBe(true);
    const text = JSON.stringify(settings);
    for (const canary of CANARIES) expect(text).not.toContain(canary);
    expect(text).not.toContain("client-id-canary");
  });

  it("reports a failure by what it means, never by the response body", async () => {
    const secretBody = { message: TOKEN, secret: "CANARY-GOOGLE-SECRET" };
    const expectations = [
      [401, /refused \(401\)/],
      [403, /may not read this project \(403\)/],
      [404, /no project with that reference was found \(404\)/],
      [500, /answered 500/],
    ];
    for (const [status, pattern] of expectations) {
      const error = await fetchAuthSettings({
        fetch: respond(status, secretBody),
        token: TOKEN,
        ref: REF,
        environment: "dev",
      }).catch((caught) => caught);
      expect(error.message).toMatch(pattern);
      expect(error.message).not.toContain(TOKEN);
      expect(error.message).not.toContain("CANARY");
    }
  });

  it("makes no request when the arguments are wrong", async () => {
    const fetchSpy = respond(200, healthyResponse);
    await expect(
      fetchAuthSettings({ fetch: fetchSpy, token: "nope", ref: REF, environment: "dev" }),
    ).rejects.toThrow(VerifyRefusal);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("UT-verify-supabase-config: the dev project", () => {
  it("passes what is built, and only warns about what is still to come", () => {
    const results = run(healthyResponse);
    for (const id of [
      "google-enabled",
      "phone-enabled",
      "phone-confirmation",
      "anonymous-off",
      "signups-open",
      "guard-hook",
      "callback-listed",
      "site-url",
      "test-codes-current",
    ]) {
      expect(statusOf(results, id)).toBe("pass");
    }
    expect(statusOf(results, "send-sms-hook")).toBe("warn");
    expect(statusOf(results, "captcha")).toBe("warn");
    expect(statusOf(results, "no-local-redirects")).toBe("skip");
    expect(statusOf(results, "no-test-codes")).toBe("skip");
    expect(summarise(results).exitCode).toBe(0);
  });

  it.each([
    ["google-enabled", { external_google_enabled: false }],
    ["phone-enabled", { external_phone_enabled: false }],
    ["phone-confirmation", { sms_autoconfirm: true }],
    ["anonymous-off", { external_anonymous_users_enabled: true }],
    ["signups-open", { disable_signup: true }],
    ["guard-hook", { hook_before_user_created_enabled: false }],
    [
      "guard-hook",
      { hook_before_user_created_uri: "pg-functions://postgres/public/another_function" },
    ],
    ["callback-listed", { uri_allow_list: "http://localhost:3000/auth/callback" }],
    ["callback-listed", { uri_allow_list: null }],
  ])("fails %s when the project is set otherwise", (id, change) => {
    const results = run(healthyResponse, "dev", change);
    expect(statusOf(results, id)).toBe("fail");
    expect(summarise(results).exitCode).toBe(1);
  });

  it("accepts a wildcard redirect entry that covers the callback, and a trailing slash on the site address", () => {
    expect(
      statusOf(run(healthyResponse, "dev", { uri_allow_list: `${SITE}/**` }), "callback-listed"),
    ).toBe("pass");
    expect(statusOf(run(healthyResponse, "dev", { site_url: `${SITE}/` }), "site-url")).toBe(
      "pass",
    );
  });

  it("only warns when the site address differs on dev", () => {
    expect(
      statusOf(run(healthyResponse, "dev", { site_url: "https://other.example.test" }), "site-url"),
    ).toBe("warn");
  });

  it("warns about test codes that have expired, and not about none", () => {
    expect(
      statusOf(
        run(healthyResponse, "dev", { sms_test_otp_valid_until: "2026-10-01T00:00:00Z" }),
        "test-codes-current",
      ),
    ).toBe("warn");
    expect(
      statusOf(
        run(healthyResponse, "dev", { sms_test_otp_valid_until: null }),
        "test-codes-current",
      ),
    ).toBe("warn");
    expect(
      statusOf(
        run(healthyResponse, "dev", { sms_test_otp: "", sms_test_otp_valid_until: null }),
        "test-codes-current",
      ),
    ).toBe("pass");
  });

  it("skips what needs the site address when it is not given, and says so", () => {
    const results = evaluateSettings({
      settings: pickChecked(healthyResponse),
      environment: "dev",
      now: NOW,
    });
    for (const id of ["callback-listed", "site-url", "send-sms-hook"]) {
      expect(statusOf(results, id)).toBe("skip");
    }
    expect(results.find((result) => result.id === "callback-listed").note).toMatch(/--site-url/);
  });
});

describe("UT-verify-supabase-config: staging and production are stricter", () => {
  it.each(["staging", "production"])(
    "passes a healthy %s project with nothing to warn about",
    (environment) => {
      const results = run(healthyProduction, environment);
      expect(results.filter((result) => result.status === "fail")).toEqual([]);
      expect(results.filter((result) => result.status === "warn")).toEqual([]);
      expect(summarise(results, { strict: true }).exitCode).toBe(0);
    },
  );

  it.each(["staging", "production"])(
    "fails %s with test codes, no Send SMS hook or no CAPTCHA",
    (environment) => {
      expect(
        statusOf(
          run(healthyProduction, environment, { sms_test_otp: "919000000001=123456" }),
          "no-test-codes",
        ),
      ).toBe("fail");
      expect(
        statusOf(
          run(healthyProduction, environment, { hook_send_sms_enabled: false }),
          "send-sms-hook",
        ),
      ).toBe("fail");
      expect(
        statusOf(
          run(healthyProduction, environment, {
            hook_send_sms_uri: "https://elsewhere.example.test/api/auth/hooks/send-sms",
          }),
          "send-sms-hook",
        ),
      ).toBe("fail");
      expect(
        statusOf(
          run(healthyProduction, environment, { security_captcha_enabled: false }),
          "captcha",
        ),
      ).toBe("fail");
      expect(
        statusOf(
          run(healthyProduction, environment, { security_captcha_provider: "hcaptcha" }),
          "captcha",
        ),
      ).toBe("fail");
      expect(
        statusOf(
          run(healthyProduction, environment, { site_url: "https://other.example.test" }),
          "site-url",
        ),
      ).toBe("fail");
    },
  );

  it("fails production, and only warns on staging, when a localhost address is still in the redirect list", () => {
    const change = { uri_allow_list: `http://localhost:3000/auth/callback,${SITE}/auth/callback` };
    expect(statusOf(run(healthyProduction, "production", change), "no-local-redirects")).toBe(
      "fail",
    );
    expect(statusOf(run(healthyProduction, "staging", change), "no-local-redirects")).toBe("warn");
    expect(
      statusOf(
        run(healthyProduction, "production", {
          uri_allow_list: `http://127.0.0.1:3000/**,${SITE}/auth/callback`,
        }),
        "no-local-redirects",
      ),
    ).toBe("fail");
  });
});

describe("UT-verify-supabase-config: the result", () => {
  it("is a failing run for a failure, and for a warning only with --strict", () => {
    const warned = run(healthyResponse);
    expect(summarise(warned).exitCode).toBe(0);
    expect(summarise(warned, { strict: true }).exitCode).toBe(1);
    expect(summarise(run(healthyResponse, "dev", { disable_signup: true })).exitCode).toBe(1);
  });

  it("prints one line per check and a count, and never a value or a secret", async () => {
    const settings = await fetchAuthSettings({
      fetch: async () => ({ status: 200, json: async () => healthyResponse }),
      token: TOKEN,
      ref: REF,
      environment: "dev",
    });
    const { lines } = summarise(
      evaluateSettings({ settings, environment: "dev", siteUrl: SITE, now: NOW }),
    );
    const text = lines.join("\n");
    expect(lines.some((line) => line.startsWith("PASS  google-enabled"))).toBe(true);
    expect(lines.at(-1)).toMatch(/^\d+ passed, \d+ failed, \d+ warned, \d+ skipped$/);
    for (const canary of CANARIES) expect(text).not.toContain(canary);
    expect(text).not.toContain(REF);
    expect(text).not.toContain("example.test");
  });
});
