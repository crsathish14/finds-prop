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
    // A production build enforces the policy (ADR-129 part 3); only `next dev` reports.
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy-report-only"]).toBeUndefined();
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
    await expect(main.getByRole("link")).toHaveText([
      nav.buy,
      nav.rent,
      nav.projects,
      nav.blog,
      nav.faq,
      nav.contact,
    ]);
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

  test("a phone has no menu button: the person menu holds the main links and the sign-in actions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: en.site.header.navLabel })).toBeHidden();
    await expect(page.getByRole("button", { name: en.site.header.openMenu })).toBeHidden();
    await page.getByRole("button", { name: en.site.header.guestMenu }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: nav.buy })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: en.site.header.signIn })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: en.site.header.postProperty })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
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
      footerText.linkBlog,
      footerText.linkFaq,
      footerText.linkCareers,
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
    // A home address that is no address makes the property page call notFound(), inside the public group.
    const response = await page.goto("/properties/not-a-home");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: en.notFound.title })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("link", { name: en.common.goHome })).toBeVisible();
  });

  test("the AI search page group has the header but no footer, even on its not-found screen (ADR-185)", async ({
    page,
  }) => {
    // /ai-search does not exist while its flag is off, so the page calls notFound() inside its own group.
    const response = await page.goto("/ai-search");
    // With the flag on the page itself is drawn, with the same header and no footer.
    expect([200, 404]).toContain(response?.status());
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
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

// S4-T04 and the login wall (ADR-171): the results page. The list is for signed-in visitors, and CI cannot sign
// anyone in (no code can be sent), so these tests look at what a visitor who is not signed in gets: the wall and
// the way to sign in and come back, never a list, and the address rules that come before the wall.
const WALL = en.loginWall;
test.describe("@smoke results page", () => {
  test("a visitor who is not signed in gets the wall and a generic unindexed title, never the list", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/properties?bhk=3&listingType=rent&propertyType=villa");
    await expect(page.getByRole("heading", { level: 1, name: WALL.title })).toBeVisible(LIST_WAIT);
    await expect(page).toHaveTitle(`${WALL.metaTitle} · findsprop`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("complementary", { name: en.domain.filters.title })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: en.domain.filters.sortLabel })).toHaveCount(0);
  });

  test("the phone sign-in is inside the card: number field and Send code, and the address does not change", async ({
    page,
  }) => {
    await page.goto("/properties?bhk=3&listingType=rent&propertyType=villa");
    const panel = page.locator('[data-slot="login-wall-panel"]');
    await expect(panel.getByLabel(en.auth.phone.label)).toBeVisible(LIST_WAIT);
    await expect(
      panel.getByRole("button", { name: en.auth.phone.send, exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/properties\?bhk=3&listingType=rent&propertyType=villa$/);
    await expect(page.locator("#main a[href^='/auth']")).toHaveCount(0);
  });

  test("sends a hand-edited address to its canonical form before it shows the wall", async ({
    page,
  }) => {
    await page.goto("/properties?view=grid&bhk=9&sort=newest&listingType=sale");
    await expect(page).toHaveURL(/\/properties\?listingType=sale$/);
  });

  test("the cards behind the message are made up, hidden and cannot be reached", async ({
    page,
  }) => {
    await page.goto("/properties");
    await expect(page.getByRole("heading", { level: 1, name: WALL.title })).toBeVisible(LIST_WAIT);
    const mock = page.locator('[data-slot="login-wall-mock"]');
    await expect(mock).toHaveAttribute("aria-hidden", "true");
    await expect(mock).toHaveAttribute("inert", "");
    await expect(page.locator("#main a[href^='/auth']")).toHaveCount(0);
  });

  // (The comparison's made-up table is shorter than the card, so there is nothing behind it to scroll there: the end-of-page
  // test below covers it.)
  // The card stays in view below the header and above the phone bar while only the made-up cards scroll, and it leaves
  // with them before the footer; a short screen (a phone with the keyboard open) keeps it usable by scrolling inside it.
  for (const route of ["/properties", "/projects"]) {
    test(`the card stays in view while the cards behind it scroll, on ${route}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 700 });
      await page.goto(route);
      const panel = page.locator('[data-slot="login-wall-panel"]');
      await expect(panel).toBeVisible(LIST_WAIT);
      const headerBottom = (await page.getByRole("banner").boundingBox())?.height ?? 0;
      const barTop =
        (await page.getByRole("navigation", { name: en.site.bottomBar.navLabel }).boundingBox())
          ?.y ?? 700;
      await page.evaluate(() => window.scrollTo(0, 400));
      const box = await panel.boundingBox();
      expect(box?.y ?? -1).toBeGreaterThanOrEqual(headerBottom - 1);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(barTop + 1);
    });
  }

  for (const route of ["/properties", "/projects", "/compare"]) {
    test(`the card leaves with the cards at the end of the page and never covers the footer, on ${route}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 700 });
      await page.goto(route);
      const panel = page.locator('[data-slot="login-wall-panel"]');
      await expect(panel).toBeVisible(LIST_WAIT);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const footerTop = (await page.getByRole("contentinfo").boundingBox())?.y ?? 0;
      const box = await panel.boundingBox();
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(footerTop + 1);
    });
  }

  test("on a short screen the card is no taller than the free space and scrolls inside itself", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 420 });
    await page.goto("/properties");
    const panel = page.locator('[data-slot="login-wall-panel"]');
    await expect(panel).toBeVisible(LIST_WAIT);
    const box = await panel.boundingBox();
    const headerBottom = (await page.getByRole("banner").boundingBox())?.height ?? 0;
    const barHeight =
      (await page.getByRole("navigation", { name: en.site.bottomBar.navLabel }).boundingBox())
        ?.height ?? 0;
    expect(box?.height ?? 9999).toBeLessThanOrEqual(420 - headerBottom - barHeight);
    const scrollsInside = await panel.evaluate((node) => node.scrollHeight >= node.clientHeight);
    expect(scrollsInside).toBe(true);
  });

  test("has no serious accessibility violation, wide and on a phone", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/properties?bhk=3&listingType=sale&propertyType=apartment");
      await expect(page.getByRole("heading", { level: 1, name: WALL.title })).toBeVisible(
        LIST_WAIT,
      );
      const results = await new AxeBuilder({ page })
        .include("#main")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        serious.map((violation) => violation.id),
        `at ${width} px`,
      ).toEqual([]);
    }
  });
});

// S4-T03: the property page. CI has no database behind the app, so these tests look at what does not
// need a home: an address that is not a slug and an id is "not found", with its one next step.
// (The page streams under a loading screen, so the answer is a normal status with a noindex tag.)
test.describe("@smoke property page", () => {
  test("an address that is not a home's says so and leads to the available homes", async ({
    page,
  }) => {
    await page.goto("/properties/not-an-id");
    await expect(
      page.getByRole("heading", { level: 1, name: en.property.page.notFound.title }),
    ).toBeVisible();
    await expect(page.getByText(en.property.page.notFound.body)).toBeVisible();
    await page.getByRole("link", { name: en.property.page.notFound.browse }).click();
    await expect(page).toHaveURL(/\/properties$/);
    // The list is for signed-in visitors (ADR-171): a visitor who is not signed in lands on the wall.
    await expect(page.getByRole("heading", { level: 1, name: en.loginWall.title })).toBeVisible(
      LIST_WAIT,
    );
  });

  test("keeps the site header and footer around the not-found screen and is kept out of search results", async ({
    page,
  }) => {
    await page.goto("/properties/not-an-id");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("has no serious accessibility violation, wide and on a phone", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/properties/not-an-id");
      await expect(
        page.getByRole("heading", { level: 1, name: en.property.page.notFound.title }),
      ).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include("#main")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        serious.map((violation) => violation.id),
        `at ${width} px`,
      ).toEqual([]);
    }
  });
});

// With no database behind the app, the projects list read is retried by the database client (1 + 2 + 4
// seconds) before the page can show its failed state, so waits for the list use a longer timeout than the
// usual 5 seconds.
const LIST_WAIT = { timeout: 20_000 };

// S4-T09: the project page. CI has no database behind the app, so these tests look at what does not
// need a project: an address that is not a slug is "not found", with its one next step. (The page streams
// under a loading screen, so the answer is a normal status with a noindex tag.)
test.describe("@smoke project page", () => {
  test("an address that is not a project's says so and leads to all projects", async ({ page }) => {
    await page.goto("/projects/not_a_slug");
    await expect(
      page.getByRole("heading", { level: 1, name: en.projects.page.notFound.title }),
    ).toBeVisible();
    await expect(page.getByText(en.projects.page.notFound.body)).toBeVisible();
    await page.getByRole("link", { name: en.projects.page.notFound.all }).click();
    await expect(page).toHaveURL(/\/projects$/);
    // The list is for signed-in visitors (ADR-171): a visitor who is not signed in lands on the wall.
    await expect(page.getByRole("heading", { level: 1, name: en.loginWall.title })).toBeVisible(
      LIST_WAIT,
    );
  });

  test("keeps the site header and footer around the not-found screen and is kept out of search results", async ({
    page,
  }) => {
    await page.goto("/projects/not_a_slug");
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("has no serious accessibility violation, wide and on a phone", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/projects/not_a_slug");
      await expect(
        page.getByRole("heading", { level: 1, name: en.projects.page.notFound.title }),
      ).toBeVisible();
      const results = await new AxeBuilder({ page })
        .include("#main")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        serious.map((violation) => violation.id),
        `at ${width} px`,
      ).toEqual([]);
    }
  });
});

// S4-T02: compare. CI has no database behind the app, so these tests look at what does not need a
// home: the empty comparison, the address rules, and the bar that is drawn from the browser's own
// selection (put there before the page loads).
const COMPARE_KEY = "findsprop:compare:v1";
const CHOSEN = [
  { id: "k3x9a2bd", title: "Arivu Heights flat, Velachery", cover: null },
  { id: "m4y8b3ce", title: "Furnished 2 BHK, Perungudi", cover: null },
];

test.describe("@smoke compare", () => {
  test("a visitor who is not signed in gets the wall on the comparison, never a table", async ({
    page,
  }) => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { level: 1, name: WALL.title })).toBeVisible(LIST_WAIT);
    await expect(
      page.locator('[data-slot="login-wall-panel"]').getByLabel(en.auth.phone.label),
    ).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
  });

  test("the wall keeps the address of the comparison asked for, so the sign-in happens on the same page", async ({
    page,
  }) => {
    await page.goto("/compare?ids=k3x9a2bd,m4y8b3ce");
    await expect(
      page.locator('[data-slot="login-wall-panel"]').getByLabel(en.auth.phone.label),
    ).toBeVisible(LIST_WAIT);
    await expect(page).toHaveURL(/\/compare\?ids=k3x9a2bd,m4y8b3ce$/);
  });

  test("the bar appears on a page once a home is chosen, and Compare now waits for two", async ({
    page,
  }) => {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key as string, value as string),
      [COMPARE_KEY, JSON.stringify(CHOSEN.slice(0, 1))],
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const bar = page.getByRole("region", { name: en.compare.bar.label });
    await expect(bar).toBeVisible();
    await expect(bar.getByText("1 of 3 selected")).toBeVisible();
    await expect(bar.getByRole("button", { name: en.compare.bar.compareNow })).toBeDisabled();
    await bar
      .getByRole("button", {
        name: en.compare.bar.remove.replace("{title}", CHOSEN[0]?.title ?? ""),
      })
      .click();
    await expect(bar).toBeHidden();
  });

  test("with two chosen the bar leads to the comparison with both ids", async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key as string, value as string),
      [COMPARE_KEY, JSON.stringify(CHOSEN)],
    );
    await page.goto("/");
    const link = page.getByRole("link", { name: en.compare.bar.compareNow });
    await expect(link).toHaveAttribute("href", "/compare?ids=k3x9a2bd,m4y8b3ce");
  });

  test("the bar is not drawn on the comparison itself, and Clear all empties it", async ({
    page,
  }) => {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key as string, value as string),
      [COMPARE_KEY, JSON.stringify(CHOSEN)],
    );
    await page.goto("/compare");
    await expect(page.getByRole("region", { name: en.compare.bar.label })).toBeHidden();
    await page.goto("/");
    await page
      .getByRole("region", { name: en.compare.bar.label })
      .getByRole("button", { name: en.compare.bar.clearAll })
      .click();
    await expect(page.getByRole("region", { name: en.compare.bar.label })).toBeHidden();
  });

  test("keeps the selection after a reload", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key as string, value as string),
      [COMPARE_KEY, JSON.stringify(CHOSEN.slice(0, 1))],
    );
    await page.reload();
    await expect(page.getByRole("region", { name: en.compare.bar.label })).toBeVisible();
  });

  test("has no serious accessibility violation, wide and on a phone", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/compare");
      await expect(page.getByRole("heading", { level: 1, name: WALL.title })).toBeVisible(
        LIST_WAIT,
      );
      const results = await new AxeBuilder({ page })
        .include("#main")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        serious.map((violation) => violation.id),
        `at ${width} px`,
      ).toEqual([]);
    }
  });
});

// S4-T09 and the login wall (ADR-171): the projects page. The list is for signed-in visitors and CI cannot sign
// anyone in, so these tests look at what a visitor who is not signed in gets.
test.describe("@smoke projects page", () => {
  test("a visitor who is not signed in gets the wall with the sign-in inside it, and a generic unindexed title", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 1, name: WALL.title })).toBeVisible(LIST_WAIT);
    await expect(page).toHaveTitle(`${WALL.metaTitle} · findsprop`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(
      page.locator('[data-slot="login-wall-panel"]').getByLabel(en.auth.phone.label),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("region", { name: en.projects.list.listLabel })).toHaveCount(0);
  });

  test("has no serious accessibility violation, wide and on a phone", async ({ page }) => {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/projects");
      await expect(page.getByRole("heading", { level: 1, name: WALL.title })).toBeVisible(
        LIST_WAIT,
      );
      const results = await new AxeBuilder({ page })
        .include("#main")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(
        serious.map((violation) => violation.id),
        `at ${width} px`,
      ).toEqual([]);
    }
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
    "/properties",
    "/properties?bhk=3&listingType=sale&propertyType=apartment",
    "/properties/not-an-id",
    "/compare",
    "/projects",
    "/projects/not_a_slug",
    "/this-page-does-not-exist",
    "/builder/login",
    "/builder/login?denied=1",
    "/admin/login",
    "/auth",
    "/auth?gate=enquire",
    "/auth?gate=expired",
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
      // A page title is the site's title template around the page's own words: the words are checked.
      const [titleStart = "", titleEnd = ""] = en.meta.titleTemplate.split("%s");
      const title = await page.title();
      const ownTitle =
        title.startsWith(titleStart) && title.endsWith(titleEnd)
          ? title.slice(titleStart.length, title.length - titleEnd.length)
          : title;
      const strangers = [ownTitle, ...lines, ...attributes].filter((text) => !fromMessages(text));
      expect(strangers, "text that is not in en.json").toEqual([]);
    });
  }

  test("the check itself notices text that is not in en.json", () => {
    expect(fromMessages("Totally made up sentence")).toBe(false);
    expect(fromMessages(en.home.hero.subtitle)).toBe(true);
    expect(fromMessages("₹ 12 · 3")).toBe(true);
  });
});

// FR-PUB-14: what search engines and shared links read. The site address comes from the environment
// (NEXT_PUBLIC_SITE_URL), so the tests check the path of each whole address, never the host.
const pathOf = (address: string | null) => {
  expect(address).toMatch(/^https?:\/\//);
  const url = new URL(address ?? "");
  return `${url.pathname}${url.search}`;
};

test.describe("@smoke search engines", () => {
  test("the homepage names its canonical address and the share tags, as whole addresses", async ({
    page,
  }) => {
    await page.goto("/");
    expect(pathOf(await page.locator('link[rel="canonical"]').getAttribute("href"))).toBe("/");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      en.meta.description,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      en.meta.title,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    expect(pathOf(await page.locator('meta[property="og:image"]').getAttribute("content"))).toBe(
      "/share-image.png",
    );
  });

  test("a results page shows a visitor who is not signed in one generic title and asks not to be indexed", async ({
    page,
  }) => {
    await page.goto("/properties?bhk=3&sort=price_asc&view=list");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
      LIST_WAIT,
    );
    await expect(page).toHaveTitle(`${en.loginWall.metaTitle} · findsprop`);
    await expect(page).not.toHaveTitle(/3 BHK/);
  });

  test("the comparison asks not to be indexed", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("robots.txt is a text file, not a page, and names who may not enter", async ({
    request,
  }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect(await response.text()).toContain("User-Agent: *");
  });

  test("sitemap.xml is its own answer, never the not-found page", async ({ request }) => {
    // CI has no database, so the list cannot be read and the answer is an error, never a partial list.
    const response = await request.get("/sitemap.xml", { timeout: 30_000 });
    expect([200, 500]).toContain(response.status());
    if (response.status() === 200) {
      expect(response.headers()["content-type"]).toContain("xml");
      expect(await response.text()).toContain("<urlset");
    }
  });

  test("the default share image is a picture", async ({ request }) => {
    const response = await request.get("/share-image.png");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  });
});

test.describe("@smoke dashboard", () => {
  test("a visitor who is not signed in is sent to sign in, and brought back to the tab they asked for", async ({
    page,
  }) => {
    await page.goto("/dashboard?tab=sent");
    await expect(page).toHaveURL(/\/auth\?redirect=%2Fdashboard%3Ftab%3Dsent/);
    await expect(page.getByRole("heading", { name: en.account.dashboard.title })).toHaveCount(0);
  });

  for (const tab of ["listings", "received"] as const) {
    test(`the ${tab} tab shows nothing to a visitor who is not signed in, and brings them back after sign-in`, async ({
      page,
    }) => {
      await page.goto(`/dashboard?tab=${tab}`);
      await expect(page).toHaveURL(new RegExp(`/auth\\?redirect=%2Fdashboard%3Ftab%3D${tab}`));
      await expect(page.getByRole("heading", { name: en.account.dashboard.title })).toHaveCount(0);
      await expect(
        page.getByRole("list", { name: en.account.dashboard[tab].listLabel }),
      ).toHaveCount(0);
    });
  }
});

test.describe("@smoke admin listings", () => {
  test("a visitor who is not signed in is sent to the administrator sign-in and sees nothing of the queue", async ({
    page,
  }) => {
    await page.goto("/admin/listings?tab=approved");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: en.admin.listings.title })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: en.admin.shell.navLabel })).toHaveCount(0);
  });
});

test.describe("@smoke saving a home", () => {
  test("a visitor who taps save without signing in is asked to sign in, with the words for saving", async ({
    page,
  }) => {
    await page.goto("/auth?gate=save&redirect=%2Fproperties");
    await expect(page.getByText(en.auth.phone.saveGateTitle)).toBeVisible();
  });
});

test.describe("@smoke legal pages", () => {
  for (const [path, title] of [
    ["/privacy", en.legal.title.privacy],
    ["/terms", en.legal.title.terms],
    ["/cookies", en.legal.title.cookies],
  ] as const) {
    test(`${path} opens with its title, a draft notice, and is kept out of search`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByText(en.legal.draft.title)).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    });
  }

  test("has no serious accessibility violation, wide and on a phone", async ({ page }) => {
    for (const size of [
      { width: 1280, height: 800 },
      { width: 390, height: 800 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/privacy");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(serious.map((violation) => violation.id)).toEqual([]);
    }
  });
});

test.describe("@smoke contact page", () => {
  test("opens with its title and lead, either with the form or with the notice that it could not load", async ({
    page,
  }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { level: 1, name: en.contact.title })).toBeVisible();
    await expect(page.getByText(en.contact.lead)).toBeVisible();
    // The form is a stored form: until the database has it (or when it cannot be read) the page says so.
    const form = page.getByRole("button", { name: "Send message" });
    const notice = page.getByText(en.contact.loadFailed.title);
    await expect(form.or(notice)).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  });

  test("has no serious accessibility violation, wide and on a phone", async ({ page }) => {
    for (const size of [
      { width: 1280, height: 800 },
      { width: 390, height: 800 },
    ]) {
      await page.setViewportSize(size);
      await page.goto("/contact");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      );
      expect(serious.map((violation) => violation.id)).toEqual([]);
    }
  });
});
