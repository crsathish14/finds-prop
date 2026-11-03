import { expect, test } from "@playwright/test";
import en from "../src/i18n/messages/en.json";

// Stage 1 smoke: the app boots, the proxy runs, the health probe answers, and unknown routes show
// the not-found page. Journeys (E2E-01 onwards) are added with the slices that implement them.
// Text is read from en.json, so rewording a message never breaks a test (ADR-035).

test.describe("@smoke app boots", () => {
  test("home page renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: en.home.title })).toBeVisible();
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
    await expect(page.getByRole("heading", { level: 1, name: en.home.title })).toBeVisible();
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
    expect(fromMessages(en.home.tagline)).toBe(true);
    expect(fromMessages("₹ 12 · 3")).toBe(true);
  });
});
