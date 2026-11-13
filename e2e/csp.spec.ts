import { expect, test, type Page } from "@playwright/test";
import en from "../src/i18n/messages/en.json";

// S8-T05 part 2: the content security policy is Report-Only today (DEC-37). Before part 3 enforces
// it, this check visits the pages that can load without data and fails on any violation the browser
// reports. A Report-Only policy still fires the page's `securitypolicyviolation` event, so the
// pages behave exactly as they will when the policy is enforced.
//
// What this cannot see (ADR-129): the Turnstile frame (the site key is empty in CI, so its script and
// iframe are never loaded) and pages that need rows from the database (a property or project page).

type Violation = { directive: string; blocked: string; source: string; disposition: string };

async function collectViolations(page: Page) {
  await page.addInitScript(() => {
    const seen: unknown[] = [];
    (window as unknown as { __csp: unknown[] }).__csp = seen;
    document.addEventListener("securitypolicyviolation", (event) => {
      seen.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        source: `${event.sourceFile}:${event.lineNumber}`,
        disposition: event.disposition,
      });
    });
  });
}

async function violationsOn(page: Page): Promise<Violation[]> {
  const all = await page.evaluate(() => (window as unknown as { __csp: Violation[] }).__csp);
  // The Design Lab shows each screen in an iframe of its own preview route. That is a same-origin
  // frame the policy does not list, and it is only there while DESIGN_LAB=1 outside production
  // (ADR-020), where the policy stays Report-Only (ADR-129 part 3). No visitor page has a frame.
  return all.filter(
    (violation) =>
      !(
        violation.directive === "frame-src" && violation.blocked.includes("/design-system/preview/")
      ),
  );
}

const PAGES = [
  "/",
  "/ta",
  "/properties",
  "/properties?bhk=3&listingType=rent&propertyType=villa",
  "/projects",
  "/compare",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
  "/ai-search",
  "/auth",
  "/builder/login",
  "/admin/login",
  "/this-page-does-not-exist",
  // The Design Lab (served with DESIGN_LAB=1) shows every component, including images, charts and
  // the gallery, so it covers more of the policy than the public pages do.
  "/design-system/components",
  "/design-system/domain",
  "/design-system/charts",
  "/design-system/forms",
  "/design-system/navigation",
  "/design-system/feedback",
  "/design-system/site-content",
];

test.describe("@smoke content security policy", () => {
  test("the check can fail: a blocked script source is reported", async ({ page }) => {
    await collectViolations(page);
    await page.goto("/");
    // `eval` is not allowed by script-src, so the browser must report it (and, once the policy is
    // enforced, refuse it). It runs from a script tag because page.evaluate is exempt from the policy. If this test ever passes with an empty list, the collector is broken.
    await page.addScriptTag({ content: "try { (0, eval)('1 + 1'); } catch {}" });
    // The browser queues the event, so it can arrive a moment after the script ran.
    await expect
      .poll(async () => (await violationsOn(page)).map((violation) => violation.directive))
      .toContain("script-src");
  });

  for (const route of PAGES) {
    test(`no violation on ${route}`, async ({ page }) => {
      await collectViolations(page);
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      expect(await violationsOn(page)).toEqual([]);
    });
  }

  test("no violation on a phone, with the menu open", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await collectViolations(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: en.site.header.openMenu }).click();
    await page.waitForLoadState("networkidle");
    expect(await violationsOn(page)).toEqual([]);
  });
});
