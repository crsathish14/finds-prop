import { describe, expect, it } from "vitest";
import messages from "@/i18n/messages/en.json";
import {
  bottomBarCurrentKey,
  buildAccountMenu,
  buildBottomBar,
  buildFooter,
  buildFooterContacts,
  buildHeader,
  initialsFrom,
  isBottomBarVisible,
  isRouteEnabled,
  markCurrent,
  signInHref,
} from "../chrome";
import { SITE_DEFAULTS } from "../defaults";
import type { FeatureFlags } from "../flags";

/** Reads the real catalogue, so a renamed key fails here and not on a page. */
function translate(key: string, values?: Record<string, string | number>): string {
  let node: unknown = messages;
  for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
  if (typeof node !== "string") throw new Error(`missing message ${key}`);
  return node.replace(/\{(\w+)\}/g, (_match, name: string) => String(values?.[name] ?? ""));
}

const flagsOff: FeatureFlags = { aiSearch: false, mapView: false, pgListings: false };
const flagsOn: FeatureFlags = { ...flagsOff, aiSearch: true };

describe("UT-site-chrome: feature flags and links (R-FE-17)", () => {
  it("drops a link to the AI search page while its flag is off, however it is written", () => {
    for (const href of ["/ai-search", "/ai-search/", "/AI-Search?q=x", "/ai-search/results#top"]) {
      expect(isRouteEnabled(href, flagsOff)).toBe(false);
      expect(isRouteEnabled(href, flagsOn)).toBe(true);
    }
  });

  it("keeps links to other pages and to other sites", () => {
    expect(isRouteEnabled("/ai-searching", flagsOff)).toBe(true);
    expect(isRouteEnabled("/projects", flagsOff)).toBe(true);
    expect(isRouteEnabled("https://example.org/ai-search", flagsOff)).toBe(true);
  });
});

describe("UT-site-chrome: header", () => {
  it("shows the catalogue's navigation when the content team saved no links (BR-81)", () => {
    const header = buildHeader(SITE_DEFAULTS.header, flagsOn, translate);
    expect(header.links.map((link) => link.label)).toEqual([
      "Buy",
      "Rent",
      "Projects",
      "AI Search",
      "Contact",
    ]);
    expect(header.brandName).toBe("Find Prop");
    expect(header.cta).toEqual({ label: "Post property", href: "/post-property" });
  });

  it("gives the AI Search link the accent, and removes it while the flag is off", () => {
    const on = buildHeader(SITE_DEFAULTS.header, flagsOn, translate);
    expect(on.links.find((link) => link.href === "/ai-search")?.accent).toBe(true);
    expect(on.links.filter((link) => link.accent)).toHaveLength(1);

    const off = buildHeader(SITE_DEFAULTS.header, flagsOff, translate);
    expect(off.links.map((link) => link.label)).toEqual(["Buy", "Rent", "Projects", "Contact"]);
  });

  it("uses the saved links whole instead of the defaults, and still applies the flags", () => {
    const header = buildHeader(
      {
        name: "Nest Finder",
        links: [
          { label: "Homes", href: "/properties" },
          { label: "Ask", href: "/ai-search" },
        ],
        cta: { label: "List a home", href: "/post-property" },
      },
      flagsOff,
      translate,
    );
    expect(header).toEqual({
      brandName: "Nest Finder",
      links: [{ label: "Homes", href: "/properties" }],
      cta: { label: "List a home", href: "/post-property" },
    });
  });

  it("leaves out a call to action that points at a route whose flag is off", () => {
    const header = buildHeader(
      { links: [], cta: { label: "Ask", href: "/ai-search" } },
      flagsOff,
      translate,
    );
    expect(header.cta).toBeUndefined();
  });
});

describe("UT-site-chrome: current page", () => {
  const items = [
    { href: "/properties" },
    { href: "/properties" },
    { href: "/projects" },
    { href: "/contact" },
    { href: "https://example.org/projects" },
  ];

  it("marks one link, the first of two that share an address", () => {
    const marked = markCurrent(items, "/properties");
    expect(marked.map((item) => item.current)).toEqual([
      true,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("marks the section a deeper page belongs to, and nothing on an unrelated page", () => {
    expect(markCurrent(items, "/projects/green-acres-ab12cd")[2]?.current).toBe(true);
    expect(markCurrent(items, "/projectsX").some((item) => item.current)).toBe(false);
    expect(markCurrent(items, "/").some((item) => item.current)).toBe(false);
  });

  it("prefers the longest match and ignores a trailing slash", () => {
    const nested = [{ href: "/dashboard" }, { href: "/dashboard/saved" }];
    expect(markCurrent(nested, "/dashboard/saved/").map((item) => item.current)).toEqual([
      undefined,
      true,
    ]);
  });

  it("treats the home link as the home page only", () => {
    const home = [{ href: "/" }, { href: "/contact" }];
    expect(markCurrent(home, "/").map((item) => item.current)).toEqual([true, undefined]);
    expect(markCurrent(home, "/contact").map((item) => item.current)).toEqual([undefined, true]);
  });
});

describe("UT-site-chrome: footer", () => {
  const year = 2026;

  it("shows the catalogue's links, the legal links and the copyright line when nothing is saved", () => {
    const footer = buildFooter(SITE_DEFAULTS, flagsOff, translate, year);
    expect(footer.columnHeading).toBe("Explore");
    expect(footer.links.map((link) => link.label)).toEqual([
      "Buy a home",
      "Rent a home",
      "New projects",
      "Contact us",
      "Post a property",
    ]);
    expect(footer.legalLinks.map((link) => link.href)).toEqual(["/privacy", "/terms"]);
    expect(footer.copyright).toBe("© 2026 Find Prop");
    expect(footer.about).toBeUndefined();
    expect(footer.contacts).toEqual([]);
  });

  it("brings the AI search link back when its flag is on", () => {
    const footer = buildFooter(SITE_DEFAULTS, flagsOn, translate, year);
    expect(footer.links.map((link) => link.label)).toContain("AI search");
  });

  it("builds the contact lines, with a dialling link only for a usable phone number", () => {
    const withPhone = buildFooter(
      {
        ...SITE_DEFAULTS,
        footer: {
          links: [],
          contact: { address: "1 Sample Road", phone: "+91 44 0000 0000", email: "hi@example.org" },
        },
      },
      flagsOff,
      translate,
      year,
    );
    expect(withPhone.contacts).toEqual([
      { kind: "address", text: "1 Sample Road" },
      { kind: "phone", text: "+91 44 0000 0000", href: "tel:+914400000000" },
      { kind: "email", text: "hi@example.org", href: "mailto:hi@example.org" },
    ]);

    const notAPhone = buildFooter(
      { ...SITE_DEFAULTS, footer: { links: [], contact: { phone: "call us" } } },
      flagsOff,
      translate,
      year,
    );
    expect(notAPhone.contacts).toEqual([{ kind: "phone", text: "call us" }]);
  });

  it("opens an address on another site in a new tab with the notice, and keeps the saved words", () => {
    const footer = buildFooter(
      {
        header: { name: "Nest Finder", links: [] },
        footer: {
          about: "A saved sentence.",
          copyright: "Saved copyright line",
          links: [
            { label: "Partner", href: "https://example.org/partner" },
            { label: "Help", href: "/contact" },
          ],
        },
      },
      flagsOff,
      translate,
      year,
    );
    expect(footer.links).toEqual([
      {
        label: "Partner",
        href: "https://example.org/partner",
        external: true,
        newTabLabel: "(opens in a new tab)",
      },
      { label: "Help", href: "/contact" },
    ]);
    expect(footer.about).toBe("A saved sentence.");
    expect(footer.copyright).toBe("Saved copyright line");
    expect(footer.brandName).toBe("Nest Finder");
  });

  it("puts the brand name and year in the default copyright line", () => {
    const footer = buildFooter(
      { ...SITE_DEFAULTS, header: { name: "Nest Finder", links: [] } },
      flagsOff,
      translate,
      2027,
    );
    expect(footer.copyright).toBe("© 2027 Nest Finder");
  });
});

describe("UT-site-chrome: the contact lines on their own (the contact page's Reach us directly)", () => {
  it("is empty when nothing is set, and holds only the lines that are", () => {
    expect(buildFooterContacts({})).toEqual([]);
    expect(buildFooterContacts({ contact: {} })).toEqual([]);
    expect(buildFooterContacts({ contact: { email: "hi@example.org" } })).toEqual([
      { kind: "email", text: "hi@example.org", href: "mailto:hi@example.org" },
    ]);
  });
});

describe("UT-site-chrome: bottom bar", () => {
  it("has the five items in order, with Post raised", () => {
    const bar = buildBottomBar(translate);
    expect(bar.items.map((item) => item.label)).toEqual(["Home", "Search", "Post", "Saved", "Me"]);
    expect(bar.items.filter((item) => item.raised).map((item) => item.key)).toEqual(["post"]);
  });

  it("shows only on the pages the navigation doc lists", () => {
    for (const path of [
      "/",
      "/properties",
      "/projects",
      "/compare",
      "/ai-search",
      "/contact",
      "/dashboard",
    ]) {
      expect(isBottomBarVisible(path)).toBe(true);
    }
    for (const path of [
      "/properties/two-bhk-ab12cd",
      "/projects/green-acres",
      "/post-property",
      "/post-property/1234",
      "/auth",
      "/builder/login",
      "/admin/dashboard",
      "/privacy",
    ]) {
      expect(isBottomBarVisible(path)).toBe(false);
    }
  });

  it("marks Home, Search and Me as current on their own pages", () => {
    expect(bottomBarCurrentKey("/")).toBe("home");
    expect(bottomBarCurrentKey("/properties")).toBe("search");
    expect(bottomBarCurrentKey("/dashboard")).toBe("me");
    expect(bottomBarCurrentKey("/contact")).toBeUndefined();
  });
});

describe("UT-site-chrome: account menu", () => {
  it("gives a customer the dashboard entries and post a property, and sends sign-out home", () => {
    const menu = buildAccountMenu({ roles: ["customer"], builderId: null }, translate);
    expect(menu.groups.map((group) => group.label)).toEqual(["Dashboard", undefined]);
    expect(menu.groups[0]?.entries.map((entry) => entry.href)).toEqual([
      "/dashboard?tab=saved",
      "/dashboard?tab=listings",
      "/dashboard?tab=received",
      "/dashboard?tab=sent",
    ]);
    expect(menu.roleLabel).toBeUndefined();
    expect(menu.signOutDestination).toBe("/");
  });

  it("adds the builder portal and a role label for an active builder, who signs out to the builder page", () => {
    const menu = buildAccountMenu({ roles: ["customer", "builder"], builderId: "b1" }, translate);
    expect(menu.groups.at(-1)).toEqual({
      label: "Workspaces",
      entries: [{ key: "builderPortal", label: "Builder portal", href: "/builder/dashboard" }],
    });
    expect(menu.roleLabel).toBe("Builder");
    expect(menu.roleTone).toBe("default");
    expect(menu.signOutDestination).toBe("/builder/login");
  });

  it("offers no builder portal to a builder whose record is not active", () => {
    const menu = buildAccountMenu({ roles: ["builder"], builderId: null }, translate);
    expect(menu.groups.map((group) => group.label)).not.toContain("Workspaces");
    expect(menu.roleLabel).toBeUndefined();
    expect(menu.signOutDestination).toBe("/builder/login");
  });

  it("sends an agent to the builder sign-in page and gives no portal entry", () => {
    const menu = buildAccountMenu({ roles: ["agent"], builderId: "b1" }, translate);
    expect(menu.signOutDestination).toBe("/builder/login");
    expect(menu.groups.map((group) => group.label)).not.toContain("Workspaces");
  });

  it("gives an administrator the admin portal, the admin tone and the admin sign-in page", () => {
    const menu = buildAccountMenu(
      { roles: ["customer", "super_admin"], builderId: null },
      translate,
    );
    expect(menu.groups.at(-1)?.entries).toEqual([
      { key: "adminPortal", label: "Admin portal", href: "/admin/dashboard" },
    ]);
    expect(menu.roleLabel).toBe("Admin");
    expect(menu.roleTone).toBe("admin");
    expect(menu.signOutDestination).toBe("/admin/login");
  });

  it("prefers the admin when a person is both admin and builder", () => {
    const menu = buildAccountMenu(
      { roles: ["builder", "super_admin"], builderId: "b1" },
      translate,
    );
    expect(menu.roleLabel).toBe("Admin");
    expect(menu.signOutDestination).toBe("/admin/login");
    expect(menu.groups.at(-1)?.entries.map((entry) => entry.key)).toEqual([
      "builderPortal",
      "adminPortal",
    ]);
  });
});

describe("UT-site-chrome: initials", () => {
  it("takes the first letters of the first and last words", () => {
    expect(initialsFrom("Priya Raman")).toBe("PR");
    expect(initialsFrom("  anitha   devi   kumar ")).toBe("AK");
  });

  it("gives one letter for one word and nothing for no name", () => {
    expect(initialsFrom("Priya")).toBe("P");
    expect(initialsFrom("   ")).toBe("");
    expect(initialsFrom(null)).toBe("");
    expect(initialsFrom(undefined)).toBe("");
  });

  it("works for names that are not written in Latin letters", () => {
    expect(initialsFrom("அன்பு குமார்")).toBe("அக");
  });
});

describe("UT-site-chrome: the header's Sign in link", () => {
  it("asks to come back to the page the visitor is on", () => {
    expect(signInHref("/projects")).toBe("/auth?redirect=%2Fprojects");
    expect(signInHref("/properties/two-bhk-ab12cd")).toBe(
      "/auth?redirect=%2Fproperties%2Ftwo-bhk-ab12cd",
    );
  });

  it("leaves the query out, because it could hold something private", () => {
    expect(signInHref("/properties?min=5000000&phone=1")).toBe("/auth?redirect=%2Fproperties");
  });

  it("sends no return address from home or from a sign-in page", () => {
    for (const path of [
      "/",
      "/auth",
      "/auth/",
      "/builder/login",
      "/admin/login",
      "/reset-password",
    ]) {
      expect(signInHref(path)).toBe("/auth");
    }
  });
});
