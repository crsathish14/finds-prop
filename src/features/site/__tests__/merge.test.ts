import { describe, expect, it, vi, type Mock } from "vitest";
import type { Logger } from "@/server/logger";
import { SITE_DEFAULTS } from "../defaults";
import { mergeSiteSettings } from "../merge";

const log = () => ({ warn: vi.fn() }) as unknown as Logger & { warn: Mock };

describe("UT-site-merge: stored site content over the built-in defaults (BR-81)", () => {
  it("gives the defaults when the table is empty", () => {
    expect(mergeSiteSettings([], log())).toEqual(SITE_DEFAULTS);
  });

  it("lets a stored field replace the default and keeps the other defaults", () => {
    const merged = mergeSiteSettings(
      [{ key: "hero", value: { title: "A title", layout: "split" } }],
      log(),
    );
    expect(merged.hero).toEqual({ title: "A title", layout: "split" });
    expect(merged.homepage).toEqual(SITE_DEFAULTS.homepage);
  });

  it("keeps the default for a field the stored value leaves out", () => {
    const merged = mergeSiteSettings([{ key: "hero", value: { title: "A title" } }], log());
    expect(merged.hero).toEqual({ title: "A title", layout: "search_desk" });
  });

  it("applies the homepage section toggles one by one (BR-82)", () => {
    const merged = mergeSiteSettings([{ key: "homepage", value: { showWhyUs: false } }], log());
    expect(merged.homepage).toEqual({ ...SITE_DEFAULTS.homepage, showWhyUs: false });
  });

  it("ignores a row that fails its schema, and logs the key but not the content", () => {
    const logger = log();
    const merged = mergeSiteSettings(
      [{ key: "hero", value: { layout: "diagonal", title: "secret content" } }],
      logger,
    );
    expect(merged.hero).toEqual(SITE_DEFAULTS.hero);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("secret content");
    expect(logger.warn.mock.calls[0]?.[1]).toEqual({ settingKey: "hero" });
  });

  it("ignores a row that is not an object", () => {
    expect(mergeSiteSettings([{ key: "footer", value: "text" }], log()).footer).toEqual(
      SITE_DEFAULTS.footer,
    );
  });

  it("ignores keys the site does not know, including inherited names", () => {
    const logger = log();
    const merged = mergeSiteSettings(
      [
        { key: "sponsors", value: { anything: 1 } },
        { key: "__proto__", value: { polluted: true } },
        { key: "constructor", value: {} },
      ],
      logger,
    );
    expect(merged).toEqual(SITE_DEFAULTS);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("refuses a link that is not a path on this site or an https address", () => {
    const logger = log();
    for (const href of [
      "javascript:alert(1)",
      "//evil.example",
      "http://plain.example",
      "data:x",
    ]) {
      const merged = mergeSiteSettings(
        [{ key: "header", value: { links: [{ label: "Link", href }] } }],
        logger,
      );
      expect(merged.header).toEqual(SITE_DEFAULTS.header);
    }
    const accepted = mergeSiteSettings(
      [
        {
          key: "header",
          value: {
            links: [
              { label: "Inside", href: "/properties" },
              { label: "Outside", href: "https://example.org/page" },
            ],
          },
        },
      ],
      logger,
    );
    expect(accepted.header.links).toHaveLength(2);
  });

  it("never changes the shared defaults", () => {
    const merged = mergeSiteSettings([{ key: "homepage", value: { showCta: false } }], log());
    merged.homepage.localities.push({ label: "Place", lat: 1, lng: 1, radiusKm: 1 });
    expect(SITE_DEFAULTS.homepage.showCta).toBe(true);
    expect(SITE_DEFAULTS.homepage.localities).toEqual([]);
  });
});
