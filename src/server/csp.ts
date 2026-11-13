/**
 * The content security policy (ADR-033, DEC-37, ADR-129 part 3). One pure function builds it, so a
 * test can pin every environment's value; proxy.ts sends it.
 *
 * Script policy: `'unsafe-inline'` stays (DEC-37 option A: Next.js writes small inline scripts and
 * a per-request nonce would make every page dynamic). The rest of the policy is strict: our own
 * origin, the project's Supabase storage, one third-party host (Cloudflare Turnstile, sign-in only).
 */

export type CspSettings = {
  /** `next dev` needs `eval` for its overlay and hot reload; a production build never does. */
  development: boolean;
  /** The local Supabase stack (APP_ENV=local) is on http://127.0.0.1; no other environment may call it. */
  localSupabase: boolean;
  /** Vercel's preview toolbar (any environment that is not production). */
  previewToolbar: boolean;
};

const TURNSTILE = "https://challenges.cloudflare.com";
const LOCAL_SUPABASE_HTTP = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_WS = "ws://127.0.0.1:54321";
const HOSTED_SUPABASE = "https://*.supabase.co";
const HOSTED_SUPABASE_WS = "wss://*.supabase.co";

/** What Vercel's toolbar loads (https://vercel.com/docs/vercel-toolbar); never sent in production. */
const TOOLBAR = "https://vercel.live";
const TOOLBAR_SOCKET = "wss://ws-us3.pusher.com";

export function buildContentSecurityPolicy(settings: CspSettings): string {
  const { development, localSupabase, previewToolbar } = settings;
  const toolbar = (...extra: string[]) => (previewToolbar ? [TOOLBAR, ...extra] : []);
  const local = (...hosts: string[]) => (localSupabase ? hosts : []);

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      HOSTED_SUPABASE,
      ...local(LOCAL_SUPABASE_HTTP),
      ...toolbar("https://vercel.com"),
    ],
    "font-src": ["'self'", ...toolbar("https://assets.vercel.com")],
    "style-src": ["'self'", "'unsafe-inline'", ...toolbar()],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(development ? ["'unsafe-eval'"] : []),
      TURNSTILE,
      ...toolbar(),
    ],
    "frame-src": [TURNSTILE, ...toolbar()],
    "connect-src": [
      "'self'",
      HOSTED_SUPABASE,
      HOSTED_SUPABASE_WS,
      ...local(LOCAL_SUPABASE_HTTP, LOCAL_SUPABASE_WS),
      ...toolbar(...(previewToolbar ? [TOOLBAR_SOCKET] : [])),
    ],
  };

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(" ")}`)
    .join("; ");
}

/**
 * A production build enforces the policy. `next dev` only reports, so a developer sees a violation
 * in the console without the page breaking while a library is being tried.
 */
export function contentSecurityPolicyHeader(settings: CspSettings & { productionBuild: boolean }): {
  name: string;
  value: string;
} {
  return {
    name: settings.productionBuild
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    value: buildContentSecurityPolicy(settings),
  };
}
