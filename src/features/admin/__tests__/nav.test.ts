import { describe, expect, it } from "vitest";
import messages from "@/i18n/messages/en.json";
import { buildAdminNav, currentNavHref } from "../nav";

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

describe("UT-admin-nav: the sidebar as data (S6-T04)", () => {
  it("lists the approved groups in order, every link once, with words from en.json", () => {
    const groups = buildAdminNav(translate, 0);
    expect(groups.map((group) => group.label ?? "")).toEqual([
      "",
      "Moderation",
      "Inventory",
      "Leads and CRM",
      "Site content",
    ]);
    const links = groups.flatMap((group) => group.items.map((item) => item.href));
    expect(links).toEqual([
      "/admin/dashboard",
      "/admin/listings",
      "/admin/projects",
      "/admin/units",
      "/admin/builders",
      "/admin/leads",
      "/admin/forms",
      "/admin/crm",
      "/admin/header",
      "/admin/hero",
      "/admin/homepage",
      "/admin/footer",
    ]);
    expect(new Set(links).size).toBe(links.length);
    expect(groups.flatMap((group) => group.items).every((item) => item.label.length > 1)).toBe(
      true,
    );
  });

  it("shows the number of pending listings beside Listings, and nowhere else", () => {
    const items = buildAdminNav(translate, 14).flatMap((group) => group.items);
    expect(
      items.filter((item) => item.count !== undefined).map((item) => [item.key, item.count]),
    ).toEqual([["listings", 14]]);
  });

  it("shows no number when nothing is pending", () => {
    const items = buildAdminNav(translate, 0).flatMap((group) => group.items);
    expect(items.some((item) => "count" in item)).toBe(false);
  });
});

describe("UT-admin-nav: which link is the current page", () => {
  const groups = buildAdminNav(translate, 0);

  it.each([
    ["/admin/listings", "/admin/listings"],
    ["/admin/listings/", "/admin/listings"],
    ["/admin/projects", "/admin/projects"],
    ["/admin/projects/new", "/admin/projects"],
    ["/admin/projects/some-id", "/admin/projects"],
    ["/admin/dashboard", "/admin/dashboard"],
  ])("%s marks %s", (path, expected) => {
    expect(currentNavHref(groups, path)).toBe(expected);
  });

  it("marks nothing before the page is known, or for a page that is not in the sidebar", () => {
    expect(currentNavHref(groups, undefined)).toBeNull();
    expect(currentNavHref(groups, "/admin")).toBeNull();
    expect(currentNavHref(groups, "/admin/listingsx")).toBeNull();
    expect(currentNavHref(groups, "/properties")).toBeNull();
  });
});
