import { describe, expect, it } from "vitest";
import { currentNavHref } from "@/features/admin";
import messages from "@/i18n/messages/en.json";
import { buildBuilderNav } from "../nav";

/** A translator that reads en.json by its dotted key, as the app's own does. */
function translate(key: string, values?: Record<string, string | number>): string {
  const found = key
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      messages as unknown,
    );
  if (typeof found !== "string") throw new Error(`No message for ${key}`);
  return Object.entries(values ?? {}).reduce(
    (text, [name, value]) => text.replace(`{${name}}`, String(value)),
    found,
  );
}

describe("UT-builder-nav: the builder's sidebar as data (S7-T03)", () => {
  it("is one list in the approved order, every link once, with words from en.json", () => {
    const groups = buildBuilderNav(translate);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.label).toBeUndefined();
    const items = groups.flatMap((group) => group.items);
    expect(items.map((item) => [item.href, item.label, item.icon])).toEqual([
      ["/builder/dashboard", "Dashboard", "dashboard"],
      ["/builder/projects", "Projects", "projects"],
      ["/builder/units", "Units", "units"],
      ["/builder/leads", "Leads", "leads"],
      ["/builder/insights", "Insights", "insights"],
      ["/builder/profile", "Profile", "profile"],
    ]);
    expect(new Set(items.map((item) => item.key)).size).toBe(items.length);
  });

  it("shows no numbers beside the links", () => {
    for (const group of buildBuilderNav(translate)) {
      for (const item of group.items) expect(item.count).toBeUndefined();
    }
  });

  it("marks the page the builder is on, including the pages under Projects", () => {
    const groups = buildBuilderNav(translate);
    expect(currentNavHref(groups, "/builder/leads")).toBe("/builder/leads");
    expect(currentNavHref(groups, "/builder/projects/new")).toBe("/builder/projects");
    expect(currentNavHref(groups, "/builder/projects/abc/")).toBe("/builder/projects");
    expect(currentNavHref(groups, "/admin/projects")).toBeNull();
  });

  it("has the shell words the frame asks for", () => {
    for (const key of ["navLabel", "portalTag", "menuOpen", "menuTitle", "menuClose", "viewSite"]) {
      expect(() => translate(`builderPortal.shell.${key}`)).not.toThrow();
    }
  });
});
