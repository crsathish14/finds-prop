import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./design-lab/helpers";
import en from "../src/i18n/messages/en.json";

// S3-T10: the staff sign-in pages and the callback. Real Google sign-in is checked by hand against
// the dev project (it needs a Google account); here we check what the app does without one.
// Text comes from en.json, so rewording a message never breaks a test (ADR-035).
const words = en.auth.staff;

test.describe("@smoke staff sign-in pages", () => {
  for (const route of ["/builder/login", "/admin/login"]) {
    test(`${route} has no serious accessibility violation on a wide screen`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      await expectNoSeriousAccessibilityViolations(page);
    });
  }

  test("the builder page offers one Google button and no password", async ({ page }) => {
    await page.goto("/builder/login");
    await expect(page.getByRole("heading", { level: 1, name: words.builder.title })).toBeVisible();
    await expect(page.getByRole("button", { name: words.google })).toBeEnabled();
    await expect(page.getByRole("button")).toHaveCount(1);
    await expect(page.locator("input")).toHaveCount(0);
    await expect(page.getByText(words.builder.invitationOnly)).toBeVisible();
    await expect(page.getByRole("link", { name: words.builder.buyerLink })).toHaveAttribute(
      "href",
      "/auth",
    );
  });

  test("the administrator page is quiet, has one Google button and is not for search engines", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { level: 1, name: words.admin.title })).toBeVisible();
    await expect(page.getByRole("button", { name: words.google })).toBeEnabled();
    await expect(page.locator("input")).toHaveCount(0);
    await expect(page.getByText(words.admin.quietNote)).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  for (const [query, title] of [
    ["denied=1", words.builder.deniedTitle],
    ["cancelled=1", words.cancelledTitle],
    ["error=1", words.errorTitle],
  ] as const) {
    test(`the builder page shows the state for ?${query}`, async ({ page }) => {
      await page.goto(`/builder/login?${query}`);
      await expect(page.getByText(title)).toBeVisible();
      await expect(page.getByRole("button", { name: words.google })).toBeEnabled();
    });
  }

  test("the administrator page shows the not-authorised state for ?denied=1", async ({ page }) => {
    await page.goto("/admin/login?denied=1");
    await expect(page.getByText(words.admin.deniedTitle)).toBeVisible();
    await expect(page.getByText(words.admin.deniedBody)).toBeVisible();
  });
});

test.describe("@smoke staff sign-in callback", () => {
  // Without a code the route never calls Supabase, so these run with no Google account.
  const cases: [string, string][] = [
    [
      "/auth/callback?area=builder&error=access_denied&error_description=x",
      "/builder/login?cancelled=1",
    ],
    [
      "/auth/callback?area=admin&error=server_error&error_description=signup_not_allowed",
      "/admin/login?denied=1",
    ],
    [
      "/auth/callback?area=builder&error=server_error&error_description=boom",
      "/builder/login?error=1",
    ],
    ["/auth/callback?area=builder", "/builder/login?error=1"],
    ["/auth/callback", "/builder/login?error=1"],
    ["/auth/callback?area=customer&code=abc", "/builder/login?error=1"],
  ];

  for (const [address, expected] of cases) {
    test(`${address} goes back to ${expected}`, async ({ request }) => {
      const response = await request.get(address, { maxRedirects: 0 });
      expect([307, 308]).toContain(response.status());
      const location = new URL(response.headers().location ?? "", "http://x");
      expect(`${location.pathname}${location.search}`).toBe(expected);
    });
  }

  test("the callback has no language prefix and still gets a request id and noindex", async ({
    request,
  }) => {
    const response = await request.get("/auth/callback", { maxRedirects: 0 });
    expect(response.status()).not.toBe(404);
    expect(response.headers()["x-request-id"]).toMatch(/^[\w-]{8,64}$/);
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  });

  test("a callback never sends the browser to another site", async ({ request }) => {
    const response = await request.get(
      "/auth/callback?area=builder&next=https://evil.example&error=access_denied",
      { maxRedirects: 0 },
    );
    const location = new URL(response.headers().location ?? "", "http://x");
    expect(location.host).toBe("x");
  });
});
