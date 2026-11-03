import type { Translate } from "@/lib/format";
import type { AppRole } from "@/server/auth/session";
import type { FeatureFlags } from "./flags";
import type { SiteSettings } from "./schemas";

/**
 * What the header, drawer, footer, bottom bar and account menu show (S4-T06), worked out from the
 * site content, the feature flags and the signed-in roles. Pure: no cookies, no database, so the
 * rules here are tested on their own and the components only lay the result out. Wording comes
 * from the message catalogue through `translate` (R-FE-21); the content team's own words (link
 * labels, the about text) are shown as they were saved.
 *
 * This file is imported by client islands in this feature, so it must stay free of server code.
 */

const AI_SEARCH_PATH = "/ai-search";

/** Routes that exist only while a flag is on (R-FE-17). A link to one is absent when it is off. */
const FLAGGED_ROUTES: { path: string; flag: keyof FeatureFlags }[] = [
  { path: AI_SEARCH_PATH, flag: "aiSearch" },
];

export type NavLink = { label: string; href: string; accent?: boolean };

export type HeaderModel = {
  brandName: string;
  links: NavLink[];
  cta?: { label: string; href: string };
};

export type FooterLinkModel = {
  label: string;
  href: string;
  external?: boolean;
  newTabLabel?: string;
};

export type FooterContactModel = {
  kind: "address" | "phone" | "email";
  text: string;
  href?: string;
};

export type FooterModel = {
  brandName: string;
  about?: string;
  columnHeading: string;
  links: FooterLinkModel[];
  contacts: FooterContactModel[];
  legalLinks: { label: string; href: string }[];
  copyright: string;
};

export type BottomBarKey = "home" | "search" | "post" | "saved" | "me";

export type BottomBarModel = {
  navLabel: string;
  items: { key: BottomBarKey; label: string; href: string; raised?: boolean }[];
};

export type AccountEntryKey =
  | "savedHomes"
  | "myListings"
  | "enquiriesReceived"
  | "myEnquiries"
  | "postProperty"
  | "builderPortal"
  | "adminPortal";

export type AccountMenuModel = {
  roleLabel?: string;
  roleTone: "default" | "admin";
  groups: {
    label?: string;
    entries: { key: AccountEntryKey; label: string; href: string }[];
  }[];
  /** Where Sign out takes the person: customers to the home page, staff to their own sign-in page. */
  signOutDestination: string;
};

/** The part of an address before any query or fragment, without a trailing slash, in lower case. */
function pathOf(href: string): string {
  const [path = ""] = href.split(/[?#]/, 1);
  const trimmed = path.replace(/\/+$/, "");
  return (trimmed === "" ? "/" : trimmed).toLowerCase();
}

/** False for a link to a route whose flag is off. Addresses on other sites are never flagged. */
export function isRouteEnabled(href: string, flags: FeatureFlags): boolean {
  if (!href.startsWith("/")) return true;
  const path = pathOf(href);
  return !FLAGGED_ROUTES.some(
    (route) => !flags[route.flag] && (path === route.path || path.startsWith(`${route.path}/`)),
  );
}

export function resolveBrandName(header: SiteSettings["header"], translate: Translate): string {
  return header.name ?? translate("site.brandName");
}

/** What the header shows when the content team has saved no links (BR-81). */
function defaultNavigation(translate: Translate): { label: string; href: string }[] {
  return [
    // Buy and Rent share an address until the search page defines its filters (S4-T04).
    { label: translate("site.nav.buy"), href: "/properties" },
    { label: translate("site.nav.rent"), href: "/properties" },
    { label: translate("site.nav.projects"), href: "/projects" },
    { label: translate("site.nav.aiSearch"), href: AI_SEARCH_PATH },
    { label: translate("site.nav.contact"), href: "/contact" },
  ];
}

export function buildHeader(
  header: SiteSettings["header"],
  flags: FeatureFlags,
  translate: Translate,
): HeaderModel {
  const source = header.links.length > 0 ? header.links : defaultNavigation(translate);
  const links = source
    .filter((link) => isRouteEnabled(link.href, flags))
    .map((link) => ({
      label: link.label,
      href: link.href,
      ...(pathOf(link.href) === AI_SEARCH_PATH ? { accent: true } : {}),
    }));
  const cta = header.cta ?? {
    label: translate("site.header.postProperty"),
    href: "/post-property",
  };
  return {
    brandName: resolveBrandName(header, translate),
    links,
    ...(isRouteEnabled(cta.href, flags) ? { cta } : {}),
  };
}

/** What the footer shows when the content team has saved no links (BR-81). */
function defaultFooterLinks(translate: Translate): { label: string; href: string }[] {
  return [
    { label: translate("site.footer.linkBuy"), href: "/properties" },
    { label: translate("site.footer.linkRent"), href: "/properties" },
    { label: translate("site.footer.linkProjects"), href: "/projects" },
    { label: translate("site.footer.linkAiSearch"), href: AI_SEARCH_PATH },
    { label: translate("site.footer.linkContact"), href: "/contact" },
    { label: translate("site.footer.linkPost"), href: "/post-property" },
  ];
}

/** A dialable `tel:` address, or nothing if the saved text does not look like a phone number. */
function telephoneHref(phone: string): string | undefined {
  const dialable = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{5,}$/.test(dialable) ? `tel:${dialable}` : undefined;
}

export function buildFooter(
  settings: Pick<SiteSettings, "header" | "footer">,
  flags: FeatureFlags,
  translate: Translate,
  year: number,
): FooterModel {
  const { footer } = settings;
  const brandName = resolveBrandName(settings.header, translate);
  const source = footer.links.length > 0 ? footer.links : defaultFooterLinks(translate);
  const links = source
    .filter((link) => isRouteEnabled(link.href, flags))
    .map((link): FooterLinkModel => {
      if (link.href.startsWith("/")) return { label: link.label, href: link.href };
      return {
        label: link.label,
        href: link.href,
        external: true,
        newTabLabel: translate("common.opensInNewTab"),
      };
    });

  const contacts: FooterContactModel[] = [];
  const { address, phone, email } = footer.contact ?? {};
  if (address) contacts.push({ kind: "address", text: address });
  if (phone) {
    const href = telephoneHref(phone);
    contacts.push({ kind: "phone", text: phone, ...(href ? { href } : {}) });
  }
  if (email) contacts.push({ kind: "email", text: email, href: `mailto:${email}` });

  return {
    brandName,
    ...(footer.about ? { about: footer.about } : {}),
    columnHeading: translate("site.footer.exploreHeading"),
    links,
    contacts,
    legalLinks: [
      { label: translate("site.footer.privacy"), href: "/privacy" },
      { label: translate("site.footer.terms"), href: "/terms" },
    ],
    copyright: footer.copyright ?? translate("site.footer.copyright", { year, brandName }),
  };
}

export function buildBottomBar(translate: Translate): BottomBarModel {
  return {
    navLabel: translate("site.bottomBar.navLabel"),
    items: [
      { key: "home", label: translate("site.bottomBar.home"), href: "/" },
      { key: "search", label: translate("site.bottomBar.search"), href: "/properties" },
      {
        key: "post",
        label: translate("site.bottomBar.post"),
        href: "/post-property",
        raised: true,
      },
      { key: "saved", label: translate("site.bottomBar.saved"), href: "/dashboard?tab=saved" },
      { key: "me", label: translate("site.bottomBar.me"), href: "/dashboard" },
    ],
  };
}

/** The pages that show the bottom bar (navigation doc, section 6). Everything else hides it. */
const BOTTOM_BAR_PAGES = new Set([
  "/",
  "/properties",
  "/projects",
  "/compare",
  "/ai-search",
  "/contact",
  "/dashboard",
]);

export function isBottomBarVisible(pathname: string): boolean {
  return BOTTOM_BAR_PAGES.has(pathOf(pathname));
}

/** Which bottom-bar item is the current page. Saved is not told apart from Me until tabs are read. */
export function bottomBarCurrentKey(pathname: string): BottomBarKey | undefined {
  const path = pathOf(pathname);
  if (path === "/") return "home";
  if (path === "/properties") return "search";
  if (path === "/dashboard") return "me";
  return undefined;
}

/**
 * Marks the one link that is the current page: the longest address that is the page or contains it,
 * the first of them when two share an address (Buy and Rent, until search filters exist). Links
 * that are not on this site never match.
 */
export function markCurrent<Item extends { href: string }>(
  items: Item[],
  pathname: string,
): (Item & { current?: boolean })[] {
  const page = pathOf(pathname);
  let winner = -1;
  let winnerLength = -1;
  items.forEach((item, index) => {
    if (!item.href.startsWith("/")) return;
    const path = pathOf(item.href);
    const matches = path === page || (path !== "/" && page.startsWith(`${path}/`));
    if (matches && path.length > winnerLength) {
      winner = index;
      winnerLength = path.length;
    }
  });
  return items.map((item, index) => (index === winner ? { ...item, current: true } : item));
}

export function buildAccountMenu(
  access: { roles: readonly AppRole[]; builderId: string | null },
  translate: Translate,
): AccountMenuModel {
  const isAdmin = access.roles.includes("super_admin");
  // An agent signs in at the builder page too (an agent is a builder with a type).
  const isStaffBuilder = access.roles.includes("builder") || access.roles.includes("agent");
  const hasBuilderPortal = access.roles.includes("builder") && access.builderId !== null;

  const workspaces: AccountMenuModel["groups"][number]["entries"] = [];
  if (hasBuilderPortal) {
    workspaces.push({
      key: "builderPortal",
      label: translate("site.account.builderPortal"),
      href: "/builder/dashboard",
    });
  }
  if (isAdmin) {
    workspaces.push({
      key: "adminPortal",
      label: translate("site.account.adminPortal"),
      href: "/admin/dashboard",
    });
  }

  const groups: AccountMenuModel["groups"] = [
    {
      label: translate("site.account.dashboardHeading"),
      entries: [
        {
          key: "savedHomes",
          label: translate("site.account.savedHomes"),
          href: "/dashboard?tab=saved",
        },
        {
          key: "myListings",
          label: translate("site.account.myListings"),
          href: "/dashboard?tab=listings",
        },
        {
          key: "enquiriesReceived",
          label: translate("site.account.enquiriesReceived"),
          href: "/dashboard?tab=received",
        },
        {
          key: "myEnquiries",
          label: translate("site.account.myEnquiries"),
          href: "/dashboard?tab=sent",
        },
      ],
    },
    {
      entries: [
        {
          key: "postProperty",
          label: translate("site.account.postProperty"),
          href: "/post-property",
        },
      ],
    },
  ];
  if (workspaces.length > 0) {
    groups.push({ label: translate("site.account.workspacesHeading"), entries: workspaces });
  }

  let signOutDestination = "/";
  if (isAdmin) signOutDestination = "/admin/login";
  else if (isStaffBuilder) signOutDestination = "/builder/login";

  return {
    ...(isAdmin
      ? { roleLabel: translate("site.account.roleAdmin") }
      : hasBuilderPortal
        ? { roleLabel: translate("site.account.roleBuilder") }
        : {}),
    roleTone: isAdmin ? "admin" : "default",
    groups,
    signOutDestination,
  };
}

/** The letters shown in the avatar: the first letters of the first and last words, or empty. */
export function initialsFrom(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  if (first === undefined) return "";
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  const letters = [first, last].map((word) =>
    word === undefined ? "" : (Array.from(word)[0] ?? ""),
  );
  return letters.join("").toLocaleUpperCase("en-IN");
}
