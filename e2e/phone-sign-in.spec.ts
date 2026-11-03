import { expect, test } from "@playwright/test";
import en from "../src/i18n/messages/en.json";

// S3-T09: the customer sign-in page. Sending a real code needs the dev project's CAPTCHA and a test
// number, so that is checked by hand; here we check what the page shows without one. Text comes from
// en.json, so rewording a message never breaks a test (ADR-035).
const words = en.auth.phone;

test.describe("@smoke phone sign-in page", () => {
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
