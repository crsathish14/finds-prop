import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import en from "../src/i18n/messages/en.json";

// Stage 1 smoke: the app boots, the proxy runs, the health probe answers, and unknown routes show
// the not-found page. Journeys (E2E-01 onwards) are added with the slices that implement them.
// Text is read from en.json, so rewording a message never breaks a test (ADR-035).

test.describe("@smoke app boots", () => {
  test("home page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: en.home.hero.title })).toBeVisible();
    await expect(page).toHaveTitle(en.meta.title);
  });

  test("the skip link is the first thing the Tab key reaches and jumps to the main content", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: en.common.skipToContent });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute("href", "#main");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
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
    await expect(page.getByRole("heading", { name: en.notFound.title })).toBeVisible();
  });

  test("the not-found page follows the approved screen: code, next step, no dead link", async ({
    page,
  }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByText(en.notFound.code)).toBeVisible();
    await expect(page.getByText(en.notFound.body)).toBeVisible();
    const home = page.getByRole("link", { name: en.common.goHome });
    await expect(home).toBeVisible();
    await home.click();
    await expect(page.getByRole("heading", { level: 1, name: en.home.hero.title })).toBeVisible();
  });
});

test.describe("@smoke language routing", () => {
  test("English has no URL prefix: /en redirects to the unprefixed address", async ({
    request,
  }) => {
    const response = await request.get("/en", { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    expect(new URL(response.headers().location ?? "", "http://x").pathname).toBe("/");
  });

  test("the page declares its language", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("a language that is not enabled is a 404, not a crash", async ({ page }) => {
    const response = await page.goto("/ta/search");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: en.notFound.title })).toBeVisible();
  });
});

// S4-T06: the site header on the public pages. The links come from the site content or, while it is
// empty, from the catalogue. AI search is absent from navigation while its flag is off (R-FE-17).
test.describe("@smoke site header", () => {
  const nav = en.site.nav;

  test("shows the brand, the main links and Sign in to a visitor, and no AI search while its flag is off", async ({
    page,
  }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    await expect(
      banner.getByRole("link", {
        name: en.site.header.homeLabel.replace("{brandName}", en.site.brandName),
      }),
    ).toHaveAttribute("href", "/");
    const main = banner.getByRole("navigation", { name: en.site.header.navLabel });
    await expect(main.getByRole("link")).toHaveText([nav.buy, nav.rent, nav.projects, nav.contact]);
    await expect(banner.getByRole("link", { name: en.site.header.signIn })).toHaveAttribute(
      "href",
      "/auth",
    );
    await expect(banner.getByRole("link", { name: en.site.header.postProperty })).toBeVisible();
    await expect(page.getByText(nav.aiSearch)).toHaveCount(0);
  });

  test("marks the page the visitor is on, and asks Sign in to come back to it", async ({
    page,
  }) => {
    // A hydration mismatch shows as a page error in the production build.
    const problems: string[] = [];
    page.on("pageerror", (error) => problems.push(error.message));
    await page.goto("/projects");
    const banner = page.getByRole("banner");
    await expect(banner.getByRole("link", { name: nav.projects })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(banner.getByRole("link", { name: en.site.header.signIn })).toHaveAttribute(
      "href",
      "/auth?redirect=%2Fprojects",
    );
    expect(problems).toEqual([]);
  });

  test("opens the menu drawer on a phone, with the main links and the sign-in actions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: en.site.header.navLabel })).toBeHidden();
    await page.getByRole("button", { name: en.site.header.openMenu }).click();
    const drawer = page.getByRole("dialog", { name: en.site.header.menuTitle });
    await expect(drawer.getByRole("link", { name: nav.buy })).toBeVisible();
    await expect(drawer.getByRole("link", { name: en.site.header.signIn })).toBeVisible();
    await expect(drawer.getByRole("link", { name: en.site.header.postProperty })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("the header itself has no serious accessibility violation, on a page with and without the hero", async ({
    page,
  }) => {
    // Scoped to the header: the rest of each page is checked with its own screen.
    for (const route of ["/", "/auth"]) {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .include("[data-slot=site-header]")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(serious.map((violation) => violation.id)).toEqual([]);
    }
  });
});

// S4-T06: the footer and the phone bottom bar. The footer's links come from the site content or,
// while it is empty, from the catalogue; the bottom bar shows only on the pages the navigation doc
// lists, and never from 768 px.
test.describe("@smoke site footer and bottom bar", () => {
  const footerText = en.site.footer;
  const bar = en.site.bottomBar;

  test("the footer shows the brand, a link column and the legal line, without AI search", async ({
    page,
  }) => {
    await page.goto("/");
    const footer = page.getByRole("contentinfo");
    await expect(
      footer.getByRole("navigation", { name: footerText.navLabel }).getByRole("heading"),
    ).toHaveText(footerText.exploreHeading);
    await expect(
      footer.getByRole("navigation", { name: footerText.navLabel }).getByRole("link"),
    ).toHaveText([
      footerText.linkBuy,
      footerText.linkRent,
      footerText.linkProjects,
      footerText.linkContact,
      footerText.linkPost,
    ]);
    await expect(footer.getByRole("link", { name: footerText.privacy })).toHaveAttribute(
      "href",
      "/privacy",
    );
    await expect(footer.getByRole("link", { name: footerText.terms })).toHaveAttribute(
      "href",
      "/terms",
    );
    await expect(footer).toContainText(new RegExp(String.raw`© \d{4} ${en.site.brandName}`));
    await expect(footer.getByText(footerText.linkAiSearch)).toHaveCount(0);
  });

  test("the sign-in pages have the footer, but the quiet administrator page does not", async ({
    page,
  }) => {
    for (const route of ["/auth", "/builder/login"]) {
      await page.goto(route);
      await expect(page.getByRole("contentinfo")).toBeVisible();
    }
    await page.goto("/admin/login");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
  });

  test("on a phone the bottom bar shows on the home page with Home marked, and not on sign-in", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: bar.navLabel });
    await expect(nav.getByRole("link")).toHaveText([
      bar.home,
      bar.search,
      bar.post,
      bar.saved,
      bar.me,
    ]);
    await expect(nav.getByRole("link", { name: bar.home })).toHaveAttribute("aria-current", "page");
    await page.goto("/auth");
    await expect(page.getByRole("navigation", { name: bar.navLabel })).toHaveCount(0);
  });

  test("the bar does not cover the end of the page: the footer can scroll clear of it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footerBottom = await page
      .getByRole("contentinfo")
      .evaluate((element) => element.getBoundingClientRect().bottom);
    const barTop = await page
      .getByRole("navigation", { name: bar.navLabel })
      .evaluate((element) => element.getBoundingClientRect().top);
    expect(footerBottom).toBeLessThanOrEqual(barTop + 1);
  });

  test("a missing page keeps the header and footer around the not-found message", async ({
    page,
  }) => {
    // /ai-search does not exist while its flag is off, so the page calls notFound().
    const response = await page.goto("/ai-search");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: en.notFound.title })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("link", { name: en.common.goHome })).toBeVisible();
  });

  test("a URL that matches no page at all still shows the plain not-found screen", async ({
    page,
  }) => {
    // global-not-found has no layout and no language context in this Next.js version.
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { name: en.notFound.title })).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
  });

  test("from 768 px there is no bottom bar", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: bar.navLabel })).toBeHidden();
  });
});

// Text-origin check (ADR-035): every line of text a visitor can see, plus the page title and the
// label and alt attributes, must be a message from en.json. It catches hard-coded text that the
// lint rule cannot see, such as a sentence kept in a variable.
function flatten(node: object, prefix = ""): string[] {
  return Object.entries(node).flatMap(([key, value]) =>
    typeof value === "string" ? [value] : flatten(value as object, `${prefix}${key}.`),
  );
}

const escape = (text: string) => text.replace(/[.*+?^$|()[\]\\]/g, "\\$&");

/**
 * A message becomes a pattern. {variables} match any text; a plural or select block matches any
 * one of its branches (so a message made only of a block cannot match everything).
 */
function toPattern(message: string): RegExp {
  let index = 0;
  function text(until: "end" | "brace"): string {
    let out = "";
    while (index < message.length) {
      const ch = message[index] as string;
      if (until === "brace" && ch === "}") break;
      index++;
      if (ch === "{") out += block();
      else if (ch === "#") out += "\\d+";
      else out += escape(ch);
    }
    return out;
  }
  function block(): string {
    const close = message.indexOf("}", index);
    const comma = message.indexOf(",", index);
    if (comma === -1 || comma > close) {
      index = close + 1;
      return ".+";
    }
    const type = /^\s*(plural|select|selectordinal)\s*,/.exec(message.slice(comma))?.[1];
    index = message.indexOf(",", comma + 1) + 1;
    if (!type) {
      index = close + 1;
      return ".+";
    }
    const branches: string[] = [];
    while (index < message.length && message[index] !== "}") {
      const open = message.indexOf("{", index);
      if (open === -1) break;
      index = open + 1;
      branches.push(text("brace"));
      index++;
    }
    index++;
    return `(?:${branches.join("|")})`;
  }
  // Case-insensitive: small labels are set in capitals by CSS, and innerText returns what is drawn.
  return new RegExp(`^${text("end")}$`, "i");
}

const PATTERNS = flatten(en).map(toPattern);
const SYMBOLS_ONLY = /^[\d\s\p{P}\p{S}]*$/u;
const fromMessages = (text: string) =>
  SYMBOLS_ONLY.test(text) || PATTERNS.some((pattern) => pattern.test(text));

test.describe("@smoke text origin", () => {
  for (const route of [
    "/",
    "/this-page-does-not-exist",
    "/builder/login",
    "/builder/login?denied=1",
    "/admin/login",
    "/auth",
    "/auth?gate=enquire",
    "/auth?email=expired",
  ]) {
    test(`all visible text on ${route} comes from en.json`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const lines = (await page.locator("body").innerText())
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const attributes = await page.evaluate(() =>
        [...document.querySelectorAll("[aria-label], img[alt], [title], [placeholder]")].flatMap(
          (element) =>
            ["aria-label", "alt", "title", "placeholder"]
              .map((name) => element.getAttribute(name))
              .filter((value): value is string => !!value),
        ),
      );
      const strangers = [await page.title(), ...lines, ...attributes].filter(
        (text) => !fromMessages(text),
      );
      expect(strangers, "text that is not in en.json").toEqual([]);
    });
  }

  test("the check itself notices text that is not in en.json", () => {
    expect(fromMessages("Totally made up sentence")).toBe(false);
    expect(fromMessages(en.home.hero.subtitle)).toBe(true);
    expect(fromMessages("₹ 12 · 3")).toBe(true);
  });
});
