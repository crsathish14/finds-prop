import { expect, test } from "@playwright/test";
import en from "../../src/i18n/messages/en.json";
import {
  BOARDS,
  captureScreenshot,
  expectNoHorizontalOverflow,
  expectNoSeriousAccessibilityViolations,
  settle,
  VIEWPORTS,
} from "./helpers";
import { PREVIEW_NAMES } from "../../src/design-lab/preview-names";

// G-10 (lab part): every Design Lab board and every whole-page preview is checked with axe and for
// sideways scrolling at 390, 820 and 1440 px, and photographed for the owner's review.

for (const viewport of VIEWPORTS) {
  test.describe(`Design Lab at ${viewport.name} px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const board of BOARDS) {
      test(`board ${board}: accessible, no sideways scroll`, async ({ page }, testInfo) => {
        await page.goto(`/design-system/${board}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await settle(page);
        await expectNoSeriousAccessibilityViolations(page);
        await expectNoHorizontalOverflow(page);
        await captureScreenshot(page, testInfo, `board-${board}-${viewport.name}`);
      });
    }

    for (const name of PREVIEW_NAMES) {
      test(`preview ${name}: accessible, no sideways scroll`, async ({ page }, testInfo) => {
        await page.goto(`/design-system/preview/${name}`);
        await settle(page);
        await expectNoSeriousAccessibilityViolations(page);
        await expectNoHorizontalOverflow(page);
        await captureScreenshot(page, testInfo, `preview-${name}-${viewport.name}`);
      });
    }
  });
}

test.describe("Design Lab routes", () => {
  test("the index lists the eight boards", async ({ page }) => {
    await page.goto("/design-system");
    await expect(page.getByRole("heading", { level: 1, name: "Design Lab" })).toBeVisible();
    for (const board of [
      "Foundations",
      "Components",
      "Navigation",
      "Feedback",
      "Ads",
      "Domain",
      "Discovery",
      "Seller",
    ]) {
      await expect(page.getByRole("link", { name: board })).toBeVisible();
    }
  });

  test("a preview name that does not exist shows the not-found page", async ({ page }) => {
    await page.goto("/design-system/preview/nothing-here");
    await expect(page.getByRole("heading", { name: en.notFound.title })).toBeVisible();
  });

  test("the pages ask search engines not to index them", async ({ page }) => {
    await page.goto("/design-system/foundations");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });
});
