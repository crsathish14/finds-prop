import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** The three widths the design is signed off at (plan 04, section 8). */
export const VIEWPORTS = [
  { name: "390", width: 390, height: 844 },
  { name: "820", width: 820, height: 1180 },
  { name: "1440", width: 1440, height: 900 },
] as const;

export const BOARDS = [
  "foundations",
  "components",
  "navigation",
  "feedback",
  "ads",
  "domain",
  "discovery",
  "seller",
  "admin",
] as const;

export async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

/** Zero serious or critical accessibility violations (WCAG 2.0 to 2.2, levels A and AA). */
export async function expectNoSeriousAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
    }));
  expect(serious, "serious or critical accessibility violations").toEqual([]);
}

/** The page itself must not scroll sideways (wide specimens scroll inside their own box). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, "page scrolls sideways").toBeLessThanOrEqual(overflow.clientWidth);
}

/**
 * Keep a full-page screenshot with the test results, for the owner's review against the UX boards.
 * Set DESIGN_LAB_VISUAL=compare to also compare it with the stored baseline (see docs/engineering).
 */
export async function captureScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
  if (process.env.DESIGN_LAB_VISUAL === "compare") {
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    });
  }
}
