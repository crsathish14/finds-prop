// S3-SPK-01 auth spike: a throwaway experiment against the dev Supabase project. The OWNER runs it from
// their own terminal; agents never do (it signs in to a shared system). It uses only the public
// (publishable) key, passed through environment variables, never from a file, and it never prints a
// token, a password, a full phone number or an email address. Delete it when ADR-010 is final.
//
//   node scripts/spike-auth.mjs phone      sign in with a test phone number and its fixed code
//   node scripts/spike-auth.mjs password   sign in a dashboard-created test user (no phone)
//   node scripts/spike-auth.mjs signup     try to sign up by email; reports whether sign-up is open
//   node scripts/spike-auth.mjs google     sign in with Google through a local callback page
//
// Environment: SPIKE_SUPABASE_URL, SPIKE_PUBLISHABLE_KEY always; SPIKE_PHONE and SPIKE_OTP for
// `phone`; SPIKE_EMAIL and SPIKE_PASSWORD for `password`; SPIKE_PORT (default 54999) for `google`.
import http from "node:http";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const mode = process.argv[2];
const supabaseUrl = process.env.SPIKE_SUPABASE_URL ?? "";
const publishableKey = process.env.SPIKE_PUBLISHABLE_KEY ?? "";

function fail(message) {
  console.error(`spike-auth: ${message}`);
  process.exit(1);
}

if (!["phone", "password", "signup", "google"].includes(mode ?? "")) {
  fail("choose a mode: phone, password, signup or google");
}
if (!/^https:\/\/[a-z0-9]{10,30}\.supabase\.co$/.test(supabaseUrl)) {
  fail(
    "SPIKE_SUPABASE_URL must look like https://<project ref>.supabase.co (the dev project only)",
  );
}
if (publishableKey.length < 20) {
  fail("SPIKE_PUBLISHABLE_KEY is missing; use the publishable key, never a secret or service key");
}
if (/service_role|secret/i.test(publishableKey)) {
  fail("that looks like a secret key; use the publishable key");
}

console.log(`Project: ${new URL(supabaseUrl).host}`);

const client = createClient(supabaseUrl, publishableKey, {
  auth: {
    flowType: "pkce",
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function decodeClaims(accessToken) {
  return JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"));
}

const presence = (value) => (value ? "set" : "empty");

// Prints what the token and the database say about the signed-in user, without any personal value.
async function summarise(session) {
  const claims = decodeClaims(session.access_token);
  console.log("\nToken claims (values hidden where personal):");
  console.log(`  phone claim:   ${presence(claims.phone)}`);
  console.log(`  email claim:   ${presence(claims.email)}`);
  console.log(`  aal:           ${claims.aal}`);
  console.log(
    `  sign-in kinds: ${(claims.amr ?? []).map((entry) => entry.method).join(", ") || "none"}`,
  );
  console.log(`  is_anonymous:  ${claims.is_anonymous}`);

  const user = session.user;
  console.log(
    `\nIdentities on the account: ${(user.identities ?? []).map((identity) => identity.provider).join(", ") || "none"}`,
  );
  console.log(
    `  phone confirmed: ${presence(user.phone_confirmed_at)}   email confirmed: ${presence(user.email_confirmed_at)}`,
  );

  const verifiedPhone = await client.rpc("has_verified_phone");
  const superAdmin = await client.rpc("is_super_admin");
  console.log("\nDatabase view of this session:");
  console.log(
    `  has_verified_phone(): ${verifiedPhone.error ? `error: ${verifiedPhone.error.message}` : verifiedPhone.data}`,
  );
  console.log(
    `  is_super_admin():     ${superAdmin.error ? `error: ${superAdmin.error.message}` : superAdmin.data}`,
  );

  const profile = await client.from("profiles").select("phone, email_verified_at").maybeSingle();
  if (profile.error) {
    console.log(`  profile row:          error: ${profile.error.message}`);
  } else if (!profile.data) {
    console.log("  profile row:          none");
  } else {
    console.log(
      `  profile row:          phone ${presence(profile.data.phone)}, email verified ${presence(profile.data.email_verified_at)}`,
    );
  }
  const roles = await client.from("user_roles").select("role");
  console.log(
    `  roles:                ${roles.error ? `error: ${roles.error.message}` : roles.data.map((row) => row.role).join(", ") || "none"}`,
  );
}

async function runPhone() {
  const phone = process.env.SPIKE_PHONE ?? "";
  const code = process.env.SPIKE_OTP ?? "";
  if (!/^\+[1-9][0-9]{7,14}$/.test(phone) || !/^[0-9]{6}$/.test(code)) {
    fail(
      "set SPIKE_PHONE (like +919000000001, a TEST number) and SPIKE_OTP (its 6 digit fixed code)",
    );
  }
  const started = Date.now();
  const sent = await client.auth.signInWithOtp({ phone });
  console.log(
    `Ask for a code: ${sent.error ? `refused: ${sent.error.message}` : "accepted"} (${Date.now() - started} ms)`,
  );
  if (sent.error) return;
  const verified = await client.auth.verifyOtp({ phone, token: code, type: "sms" });
  console.log(
    `Verify the code: ${verified.error ? `refused: ${verified.error.message}` : "accepted"}`,
  );
  if (verified.error || !verified.data.session) return;
  await summarise(verified.data.session);
}

async function runPassword() {
  const email = process.env.SPIKE_EMAIL ?? "";
  const password = process.env.SPIKE_PASSWORD ?? "";
  if (!email.includes("@") || password.length < 6) {
    fail("set SPIKE_EMAIL and SPIKE_PASSWORD for the test user you created in the dashboard");
  }
  const signedIn = await client.auth.signInWithPassword({ email, password });
  console.log(`Sign in: ${signedIn.error ? `refused: ${signedIn.error.message}` : "accepted"}`);
  if (signedIn.error || !signedIn.data.session) return;
  await summarise(signedIn.data.session);
}

async function runSignup() {
  const email = `spike-${randomUUID().slice(0, 8)}@example.test`;
  const attempt = await client.auth.signUp({ email, password: randomUUID() });
  if (attempt.error) {
    console.log(`Email sign-up: refused (${attempt.error.message}). Sign-up by email is closed.`);
    return;
  }
  console.log("Email sign-up: ACCEPTED, so sign-up by email is open on this project.");
  console.log(
    "A throwaway account was created; delete users named spike-...@example.test in the dashboard.",
  );
}

async function runGoogle() {
  const port = Number(process.env.SPIKE_PORT ?? "54999");
  const callback = `http://localhost:${port}/callback`;
  const started = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback, skipBrowserRedirect: true },
  });
  if (started.error || !started.data.url) {
    fail(`Google sign-in could not start: ${started.error?.message ?? "no address returned"}`);
  }
  console.log(
    `\nAdd ${callback} to the project's redirect URL list, then open this address in your browser:\n`,
  );
  console.log(started.data.url);
  console.log("\nWaiting up to 5 minutes for you to finish signing in...");

  const outcome = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ problem: "timed out" }), 5 * 60 * 1000);
    const server = http.createServer((request, response) => {
      const address = new URL(request.url ?? "/", callback);
      if (address.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("You can close this tab and go back to the terminal.");
      clearTimeout(timer);
      server.close();
      resolve({
        code: address.searchParams.get("code"),
        problem: address.searchParams.get("error_description") ?? address.searchParams.get("error"),
      });
    });
    server.listen(port, "127.0.0.1");
  });
  if (outcome.problem || !outcome.code) {
    console.log(`Google sign-in did not finish: ${outcome.problem ?? "no code returned"}`);
    return;
  }
  const exchanged = await client.auth.exchangeCodeForSession(outcome.code);
  console.log(
    `Google sign-in: ${exchanged.error ? `refused: ${exchanged.error.message}` : "accepted"}`,
  );
  if (exchanged.error || !exchanged.data.session) return;
  await summarise(exchanged.data.session);
}

const runners = { phone: runPhone, password: runPassword, signup: runSignup, google: runGoogle };
await runners[mode]();
