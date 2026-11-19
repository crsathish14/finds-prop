import { describe, expect, it } from "vitest";
import { SITE_DEFAULTS } from "../defaults";
import { CONTENT_MODULES, isContentModuleOn } from "../modules";
import type { SiteSettings } from "../schemas";

function settingsWith(modules: SiteSettings["content_modules"]): SiteSettings {
  return { ...structuredClone(SITE_DEFAULTS), content_modules: modules };
}

describe("UT-content-modules: which modules are switched on (ADR-143)", () => {
  it("names the three modules once, in the order the dashboard shows them", () => {
    expect([...CONTENT_MODULES]).toEqual(["blog", "faq", "careers"]);
  });

  it("has every module on by default", () => {
    for (const moduleName of CONTENT_MODULES) {
      expect(isContentModuleOn(SITE_DEFAULTS, moduleName)).toBe(true);
    }
  });

  it("reads each switch on its own", () => {
    const settings = settingsWith({ blog: false, faq: true, careers: false });
    expect(isContentModuleOn(settings, "blog")).toBe(false);
    expect(isContentModuleOn(settings, "faq")).toBe(true);
    expect(isContentModuleOn(settings, "careers")).toBe(false);
  });
});
