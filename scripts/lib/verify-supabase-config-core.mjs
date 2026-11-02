// The logic of scripts/verify-supabase-config.mjs (S3-T14), kept apart so tests can drive it without a
// token. Many Supabase settings live in the dashboard, not in a migration: providers, hooks, redirect
// addresses, test codes, CAPTCHA. This compares a project's Auth settings with what the app expects,
// so a slip (a wrong redirect list, a hook switched off, test codes left on in production) is caught
// before it is found by a visitor. It only ever reads.
//
// The settings come back in the same response as secrets (the Google client secret, hook secrets, SMS
// credentials). `pickChecked` therefore keeps only the few fields that are checked, as soon as the
// response arrives, and turns the test codes into a plain yes or no. Nothing else is held or printed.

/** A refusal before any request: wrong arguments, or a token that is not an access token. */
export class VerifyRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = "VerifyRefusal";
  }
}

export const ENVIRONMENTS = ["dev", "staging", "production"];

/** Where the before-user-created guard lives (migration 20261102100000, docs/runbooks/before-user-created-hook.md). */
export const GUARD_HOOK_URI = "pg-functions://postgres/public/hook_before_user_created";

const MANAGEMENT_API = "https://api.supabase.com";

/** The access token and project reference, checked before any request leaves the machine. */
export function assertRequest({ token, ref, environment }) {
  if (typeof token !== "string" || token.length === 0) {
    throw new VerifyRefusal("SUPABASE_ACCESS_TOKEN is not set in this terminal");
  }
  if (!token.startsWith("sbp_")) {
    throw new VerifyRefusal(
      "SUPABASE_ACCESS_TOKEN does not look like a personal access token (they start with sbp_); never use a service or secret key here",
    );
  }
  if (typeof ref !== "string" || !/^[a-z]{20}$/.test(ref)) {
    throw new VerifyRefusal(
      "the project reference must be the 20 lowercase letters of the project",
    );
  }
  if (!ENVIRONMENTS.includes(environment)) {
    throw new VerifyRefusal(`--environment must be one of ${ENVIRONMENTS.join(", ")}`);
  }
}

/** The Auth settings this script looks at: names only, never values. */
export const CHECKED_FIELDS = [
  "external_google_enabled",
  "external_phone_enabled",
  "external_anonymous_users_enabled",
  "disable_signup",
  "site_url",
  "uri_allow_list",
  "hook_before_user_created_enabled",
  "hook_before_user_created_uri",
  "hook_send_sms_enabled",
  "hook_send_sms_uri",
  "sms_test_otp_valid_until",
  "sms_autoconfirm",
  "security_captcha_enabled",
  "security_captcha_provider",
];

/** Keeps only the checked fields; the test codes become a yes or no. Everything else is dropped here. */
export function pickChecked(config) {
  const picked = {};
  for (const name of CHECKED_FIELDS) picked[name] = config?.[name];
  picked.sms_test_otp_set =
    typeof config?.sms_test_otp === "string" && config.sms_test_otp.length > 0;
  return picked;
}

/** Reads the project's Auth settings and returns only the checked fields. Reports a failure by status, never by body. */
export async function fetchAuthSettings({ fetch: fetchImpl, token, ref, environment }) {
  assertRequest({ token, ref, environment });
  const response = await fetchImpl(`${MANAGEMENT_API}/v1/projects/${ref}/config/auth`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  if (response.status === 401)
    throw new Error("the access token was refused (401); create a new one");
  if (response.status === 403) throw new Error("the access token may not read this project (403)");
  if (response.status === 404) throw new Error("no project with that reference was found (404)");
  if (response.status !== 200) throw new Error(`the management API answered ${response.status}`);
  return pickChecked(await response.json());
}

// ---------------------------------------------------------------------------------------------
// The checks

const splitList = (value) =>
  typeof value === "string"
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

/** An allow-list entry covers an address when it is the same, or a `/**` entry above it. */
function covers(entry, address) {
  if (entry === address) return true;
  return entry.endsWith("/**") && address.startsWith(entry.slice(0, -2));
}

function isLocalEntry(entry) {
  try {
    const { hostname } = new URL(entry.replace("**", "x"));
    return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}

const trimSlash = (value) => (typeof value === "string" ? value.replace(/\/+$/, "") : value);

/**
 * Each check: what it asks, and how serious a miss is in each environment ('fail' stops the run,
 * 'warn' is reported, 'skip' does not apply). The dev project is still being built, so what depends on
 * unfinished work (the Send SMS hook waits on DLT approval, CAPTCHA on the phone sign-in) only warns there.
 */
const CHECKS = [
  {
    id: "google-enabled",
    asks: "Google sign-in is on (staff sign in with Google only)",
    levels: { dev: "fail", staging: "fail", production: "fail" },
    test: (settings) => settings.external_google_enabled === true,
  },
  {
    id: "phone-enabled",
    asks: "Phone sign-in is on (customers sign in with a code)",
    levels: { dev: "fail", staging: "fail", production: "fail" },
    test: (settings) => settings.external_phone_enabled === true,
  },
  {
    id: "phone-confirmation",
    asks: "a phone number must be confirmed with a code",
    levels: { dev: "fail", staging: "fail", production: "fail" },
    test: (settings) => settings.sms_autoconfirm === false,
  },
  {
    id: "anonymous-off",
    asks: "anonymous sign-ins are off",
    levels: { dev: "fail", staging: "fail", production: "fail" },
    test: (settings) => settings.external_anonymous_users_enabled !== true,
  },
  {
    id: "signups-open",
    asks: "sign-ups are open (the guard decides who may create an account; with sign-ups off, the first Google sign-in of a staff member fails)",
    levels: { dev: "fail", staging: "fail", production: "fail" },
    test: (settings) => settings.disable_signup === false,
  },
  {
    id: "guard-hook",
    asks: "the before-user-created guard is on and points at hook_before_user_created",
    levels: { dev: "fail", staging: "fail", production: "fail" },
    test: (settings) =>
      settings.hook_before_user_created_enabled === true &&
      settings.hook_before_user_created_uri === GUARD_HOOK_URI,
  },
  {
    id: "callback-listed",
    asks: "the staff sign-in callback address is in the redirect list",
    levels: { dev: "fail", staging: "fail", production: "fail" },
    needsSiteUrl: true,
    test: (settings, { siteUrl }) =>
      splitList(settings.uri_allow_list).some((entry) => covers(entry, `${siteUrl}/auth/callback`)),
  },
  {
    id: "site-url",
    asks: "the site address is this deployment's address",
    levels: { dev: "warn", staging: "fail", production: "fail" },
    needsSiteUrl: true,
    test: (settings, { siteUrl }) => trimSlash(settings.site_url) === siteUrl,
  },
  {
    id: "no-local-redirects",
    asks: "no localhost address is in the redirect list",
    levels: { dev: "skip", staging: "warn", production: "fail" },
    test: (settings) => !splitList(settings.uri_allow_list).some(isLocalEntry),
  },
  {
    id: "send-sms-hook",
    asks: "the Send SMS hook is on and points at /api/auth/hooks/send-sms",
    levels: { dev: "warn", staging: "fail", production: "fail" },
    needsSiteUrl: true,
    test: (settings, { siteUrl }) =>
      settings.hook_send_sms_enabled === true &&
      trimSlash(settings.hook_send_sms_uri) === `${siteUrl}/api/auth/hooks/send-sms`,
  },
  {
    id: "captcha",
    asks: "CAPTCHA is on with Turnstile",
    levels: { dev: "warn", staging: "fail", production: "fail" },
    test: (settings) =>
      settings.security_captcha_enabled === true &&
      settings.security_captcha_provider === "turnstile",
  },
  {
    id: "no-test-codes",
    asks: "no test phone numbers with fixed codes are set",
    levels: { dev: "skip", staging: "fail", production: "fail" },
    test: (settings) => settings.sms_test_otp_set === false,
  },
  {
    id: "test-codes-current",
    asks: "test phone numbers, if set, have not expired",
    levels: { dev: "warn", staging: "skip", production: "skip" },
    test: (settings, { now }) =>
      settings.sms_test_otp_set === false ||
      (typeof settings.sms_test_otp_valid_until === "string" &&
        Date.parse(settings.sms_test_otp_valid_until) > now),
  },
];

/**
 * Runs every check for one environment. `siteUrl` is the address the app is served from (no path); the
 * checks that need it are skipped, with a message, when it is not given. Returns one result per check:
 * { id, asks, status: pass | fail | warn | skip, note }.
 */
export function evaluateSettings({ settings, environment, siteUrl, now = Date.now() }) {
  const address = siteUrl ? trimSlash(siteUrl) : undefined;
  return CHECKS.map((check) => {
    const level = check.levels[environment];
    if (level === "skip")
      return { id: check.id, asks: check.asks, status: "skip", note: "does not apply here" };
    if (check.needsSiteUrl && !address) {
      return {
        id: check.id,
        asks: check.asks,
        status: "skip",
        note: "pass --site-url to check this",
      };
    }
    const passed = check.test(settings, { siteUrl: address, now });
    if (passed) return { id: check.id, asks: check.asks, status: "pass", note: "" };
    return {
      id: check.id,
      asks: check.asks,
      status: level,
      note: level === "warn" ? "not set yet (allowed on this environment)" : "not as expected",
    };
  });
}

/** One printable line per result, and the exit code: 1 when anything failed (or warned, with `strict`). */
export function summarise(results, { strict = false } = {}) {
  const label = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };
  const lines = results.map(
    (result) =>
      `${label[result.status]}  ${result.id.padEnd(20)} ${result.asks}${result.note ? ` (${result.note})` : ""}`,
  );
  const count = (status) => results.filter((result) => result.status === status).length;
  const failed = count("fail") + (strict ? count("warn") : 0);
  lines.push(
    "",
    `${count("pass")} passed, ${count("fail")} failed, ${count("warn")} warned, ${count("skip")} skipped`,
  );
  return { lines, exitCode: failed > 0 ? 1 : 0 };
}
