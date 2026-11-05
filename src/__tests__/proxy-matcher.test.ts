import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("next-intl/middleware", () => ({ default: () => vi.fn() }));
vi.mock("@/lib/public-env", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
  },
}));
vi.mock("@/server/env", () => ({ env: { APP_ENV: "test" } }));

const { config } = await import("../proxy");

/** Which paths the proxy runs for, read the way Next.js reads the matcher. */
function runsFor(pathname: string): boolean {
  return config.matcher.some((pattern) => new RegExp(`^${pattern}$`).test(pathname));
}

describe("UT-proxy-matcher: which requests get the language rewrite and the session refresh", () => {
  it("runs for pages and for route handlers under /api", () => {
    for (const path of ["/", "/properties", "/properties/flat-k3x9a2bd", "/api/health"]) {
      expect(runsFor(path), path).toBe(true);
    }
  });

  it("leaves robots.txt and sitemap.xml alone: they have no language prefix, so a rewrite would 404 them", () => {
    expect(runsFor("/robots.txt")).toBe(false);
    expect(runsFor("/sitemap.xml")).toBe(false);
  });

  it("leaves static files and images alone, the share image among them", () => {
    for (const path of ["/_next/static/a.js", "/favicon.ico", "/share-image.png", "/logo.svg"]) {
      expect(runsFor(path), path).toBe(false);
    }
  });
});
