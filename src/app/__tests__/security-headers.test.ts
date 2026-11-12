import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

/**
 * S8-T05 (ADR-129, ASVS V14): the static security headers are sent on every path, and the settings
 * that would leak the stack or the source are off. The environment-dependent headers (the request
 * id, noindex and the content security policy) are set in proxy.ts and checked by the smoke test.
 */
describe("UT-security-headers: next.config.ts", () => {
  it("sends the five static headers on every path", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe("/:path*");
    const sent = Object.fromEntries(
      (rules[0]?.headers ?? []).map((header) => [header.key, header.value]),
    );
    expect(sent).toEqual({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(self), payment=(), usb=()",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
  });

  it("does not announce the framework and does not publish source maps", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(nextConfig.productionBrowserSourceMaps ?? false).toBe(false);
  });

  it("lets pictures come only from the project's storage, over https (and the local stack)", () => {
    const patterns = nextConfig.images?.remotePatterns ?? [];
    for (const pattern of patterns) {
      expect(pattern).toMatchObject({ pathname: "/storage/v1/object/public/**" });
    }
    expect(
      patterns.filter((pattern) => "protocol" in pattern && pattern.protocol === "http"),
    ).toEqual([expect.objectContaining({ hostname: "127.0.0.1", port: "54321" })]);
  });
});
