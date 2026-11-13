import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, contentSecurityPolicyHeader } from "../csp";

/**
 * S8-T05 part 3 (ADR-129, DEC-37): the policy of every environment is pinned here, so loosening it
 * is a visible change in review (R-SEC-06). proxy.ts only chooses the settings and sends the value.
 */
const PRODUCTION = { development: false, localSupabase: false, previewToolbar: false };

function directive(policy: string, name: string): string[] {
  const found = policy.split("; ").find((part) => part.startsWith(`${name} `));
  if (!found) throw new Error(`no ${name} directive`);
  return found.slice(name.length + 1).split(" ");
}

describe("UT-csp: the production policy", () => {
  const policy = buildContentSecurityPolicy(PRODUCTION);

  it("denies framing, plugins, a changed base address and a form sent elsewhere", () => {
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "base-uri")).toEqual(["'self'"]);
    expect(directive(policy, "form-action")).toEqual(["'self'"]);
    expect(directive(policy, "default-src")).toEqual(["'self'"]);
  });

  it("lets script come from us and Cloudflare Turnstile only, never from eval", () => {
    expect(directive(policy, "script-src")).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://challenges.cloudflare.com",
    ]);
    expect(directive(policy, "frame-src")).toEqual(["https://challenges.cloudflare.com"]);
  });

  it("lets pictures and calls go to our project's Supabase and nowhere else", () => {
    expect(directive(policy, "img-src")).toEqual([
      "'self'",
      "data:",
      "blob:",
      "https://*.supabase.co",
    ]);
    expect(directive(policy, "connect-src")).toEqual([
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
    ]);
  });

  it("does not mention the local stack, the preview toolbar or a bare wildcard", () => {
    expect(policy).not.toContain("127.0.0.1");
    expect(policy).not.toContain("vercel");
    expect(policy).not.toContain("unsafe-eval");
    for (const part of policy.split("; ")) {
      expect(part.split(" ").slice(1)).not.toContain("*");
      expect(part.split(" ").slice(1)).not.toContain("http:");
      expect(part.split(" ").slice(1)).not.toContain("https:");
    }
  });
});

describe("UT-csp: what each environment adds", () => {
  it("lets only the local environment reach the local Supabase stack", () => {
    const policy = buildContentSecurityPolicy({ ...PRODUCTION, localSupabase: true });
    expect(directive(policy, "connect-src")).toEqual(
      expect.arrayContaining(["http://127.0.0.1:54321", "ws://127.0.0.1:54321"]),
    );
    expect(directive(policy, "img-src")).toContain("http://127.0.0.1:54321");
  });

  it("lets a preview load Vercel's toolbar and nothing else changes", () => {
    const preview = buildContentSecurityPolicy({ ...PRODUCTION, previewToolbar: true });
    for (const name of ["script-src", "style-src", "frame-src", "connect-src", "font-src"]) {
      expect(directive(preview, name)).toContain("https://vercel.live");
    }
    expect(directive(preview, "connect-src")).toContain("wss://ws-us3.pusher.com");
    expect(directive(preview, "frame-ancestors")).toEqual(["'none'"]);
    expect(preview).not.toContain("unsafe-eval");
  });

  it("allows eval under next dev only", () => {
    const dev = buildContentSecurityPolicy({ ...PRODUCTION, development: true });
    expect(directive(dev, "script-src")).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy(PRODUCTION)).not.toContain("'unsafe-eval'");
  });
});

describe("UT-csp: the header", () => {
  it("is enforced in a production build and report-only under next dev", () => {
    expect(contentSecurityPolicyHeader({ ...PRODUCTION, productionBuild: true }).name).toBe(
      "Content-Security-Policy",
    );
    expect(
      contentSecurityPolicyHeader({ ...PRODUCTION, development: true, productionBuild: false })
        .name,
    ).toBe("Content-Security-Policy-Report-Only");
  });
});
