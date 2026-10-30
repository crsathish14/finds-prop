import { expect, test } from "@playwright/test";

// Stage 1 smoke: the app boots, the proxy runs, the health probe answers, and unknown routes show
// the not-found page. Journeys (E2E-01 onwards) are added with the slices that implement them.

test.describe("@smoke app boots", () => {
  test("home page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Find Prop" })).toBeVisible();
    await expect(page).toHaveTitle(/Find Prop/);
  });

  test("health probe is ok and uncached", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", app: "findsprop" });
    expect(response.headers()["cache-control"]).toBe("no-store");
  });

  test("proxy adds a request id, noindex outside production and the security headers", async ({
    request,
  }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["x-request-id"]).toMatch(/^[\w-]{8,64}$/);
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy-report-only"]).toContain("frame-ancestors 'none'");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("a caller-supplied request id is kept, a malformed one is replaced", async ({ request }) => {
    const kept = await request.get("/", { headers: { "x-request-id": "abc12345-test" } });
    expect(kept.headers()["x-request-id"]).toBe("abc12345-test");
    const replaced = await request.get("/", { headers: { "x-request-id": "bad id with spaces" } });
    expect(replaced.headers()["x-request-id"]).not.toBe("bad id with spaces");
  });

  test("unknown routes show the not-found page", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /couldn't find that page/i })).toBeVisible();
  });
});
