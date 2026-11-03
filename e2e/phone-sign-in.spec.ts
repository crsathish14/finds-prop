import { expect, test } from "@playwright/test";
import { expectNoSeriousAccessibilityViolations } from "./design-lab/helpers";
import en from "../src/i18n/messages/en.json";

// S3-T09: the customer sign-in page. Sending a real code needs the dev project's CAPTCHA and a test
// number, so that is checked by hand; here we check what the page shows without one. Text comes from
// en.json, so rewording a message never breaks a test (ADR-035).
const words = en.auth.phone;

test.describe("@smoke phone sign-in page", () => {
  test("has no serious accessibility violation, including the side panel on a wide screen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/auth");
    await page.waitForLoadState("networkidle");
    await expectNoSeriousAccessibilityViolations(page);
  });

  test("offers a mobile number field and Send code, and no Google or password", async ({
    page,
  }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    await expect(page.getByLabel(words.label)).toBeVisible();
    await expect(page.getByRole("button", { name: words.send })).toBeVisible();
    await expect(page.getByText(/google/i)).toHaveCount(0);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("links the builder sign-in and the legal pages", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("link", { name: words.builderLink })).toHaveAttribute(
      "href",
      "/builder/login",
    );
    await expect(page.getByRole("link", { name: words.termsLink })).toHaveAttribute(
      "href",
      "/terms",
    );
    await expect(page.getByRole("link", { name: words.privacyLink })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  test("explains why the visitor is here when sent by an action that needs an account", async ({
    page,
  }) => {
    await page.goto("/auth?gate=enquire");
    await expect(page.getByText(words.gateTitle)).toBeVisible();
    await expect(page.getByText(words.gateBody)).toBeVisible();
  });
});

// S3-T09: the email link (ADD-03). A real link needs a signed-in session and the dev project's email,
// so that is checked by hand; here we check what a browser sees without either, and that the link
// route refuses a missing or malformed token without asking Supabase.
const emailWords = en.auth.email;

test.describe("@smoke email link", () => {
  test("shows the expired page to a visitor who is not signed in", async ({ page }) => {
    await page.goto("/auth?email=expired");
    await expect(
      page.getByRole("heading", { level: 1, name: emailWords.expiredTitle }),
    ).toBeVisible();
    await expect(page.getByText(emailWords.expiredBody)).toBeVisible();
    await expect(page.getByRole("button", { name: emailWords.newLink })).toBeVisible();
    await expect(page.getByRole("button", { name: emailWords.dashboard })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("shows the sign-in page, not a thank-you, for a stale verified link", async ({ page }) => {
    await page.goto("/auth?email=verified");
    await expect(page.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    await expect(page.getByText(emailWords.verifiedTitle)).toHaveCount(0);
  });

  test("ignores an unknown ?email= value", async ({ page }) => {
    await page.goto("/auth?email=hacked");
    await expect(page.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
  });

  for (const query of [
    "",
    "?token_hash=short&type=email_change",
    "?token_hash=abcdefghij0123456789&type=recovery",
    "?token_hash=abc%20def%3Cscript%3E12345&type=email_change",
  ]) {
    test(`/auth/confirm${query || " with nothing"} lands on the expired page`, async ({ page }) => {
      await page.goto(`/auth/confirm${query}`);
      await expect(page).toHaveURL(/\/auth\?email=expired$/);
      await expect(
        page.getByRole("heading", { level: 1, name: emailWords.expiredTitle }),
      ).toBeVisible();
    });
  }
});
