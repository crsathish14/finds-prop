import type { Translate } from "@/lib/format";

/**
 * The admin portal's sidebar as plain data (S6-T04, FR-ADM-02): the groups and links of the approved admin
 * navigation (UX assets, portal shell), with their words already looked up. No framework and no icons here, so it
 * can be tested alone and crosses from the server to the client shell as it is; the shell turns an icon name into
 * the drawing. Only Listings is a finished page so far; the others open their placeholders.
 */

export type AdminIconName =
  | "dashboard"
  | "listings"
  | "projects"
  | "units"
  | "builders"
  | "leads"
  | "forms"
  | "crm"
  | "header"
  | "hero"
  | "homepage"
  | "footer";

export type AdminNavItem = {
  key: string;
  href: string;
  label: string;
  icon: AdminIconName;
  /** A number shown beside the label, left out when there is none (zero is none). */
  count?: number;
};

export type AdminNavGroup = { label?: string; items: AdminNavItem[] };

/** The groups in the order of the approved navigation. Literal message keys, so the messages check sees them. */
export function buildAdminNav(translate: Translate, pendingListings: number): AdminNavGroup[] {
  return [
    {
      items: [
        {
          key: "overview",
          href: "/admin/dashboard",
          label: translate("admin.nav.overview"),
          icon: "dashboard",
        },
      ],
    },
    {
      label: translate("admin.nav.moderation"),
      items: [
        {
          key: "listings",
          href: "/admin/listings",
          label: translate("admin.nav.listings"),
          icon: "listings",
          ...(pendingListings > 0 ? { count: pendingListings } : {}),
        },
        {
          key: "projects",
          href: "/admin/projects",
          label: translate("admin.nav.projects"),
          icon: "projects",
        },
      ],
    },
    {
      label: translate("admin.nav.inventory"),
      items: [
        { key: "units", href: "/admin/units", label: translate("admin.nav.units"), icon: "units" },
        {
          key: "builders",
          href: "/admin/builders",
          label: translate("admin.nav.builders"),
          icon: "builders",
        },
      ],
    },
    {
      label: translate("admin.nav.leadsAndCrm"),
      items: [
        { key: "leads", href: "/admin/leads", label: translate("admin.nav.leads"), icon: "leads" },
        { key: "forms", href: "/admin/forms", label: translate("admin.nav.forms"), icon: "forms" },
        { key: "crm", href: "/admin/crm", label: translate("admin.nav.crm"), icon: "crm" },
      ],
    },
    {
      label: translate("admin.nav.siteContent"),
      items: [
        {
          key: "header",
          href: "/admin/header",
          label: translate("admin.nav.header"),
          icon: "header",
        },
        { key: "hero", href: "/admin/hero", label: translate("admin.nav.hero"), icon: "hero" },
        {
          key: "homepage",
          href: "/admin/homepage",
          label: translate("admin.nav.homepage"),
          icon: "homepage",
        },
        {
          key: "footer",
          href: "/admin/footer",
          label: translate("admin.nav.footer"),
          icon: "footer",
        },
      ],
    },
  ];
}

/**
 * The link of the page the admin is on: the one whose address is the page's, or the longest one the page sits
 * under (a project's edit page is under Projects). None when the page is not in the navigation.
 */
export function currentNavHref(
  groups: AdminNavGroup[],
  pathname: string | undefined,
): string | null {
  if (!pathname) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  let best: string | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const under = path === item.href || path.startsWith(`${item.href}/`);
      if (under && (best === null || item.href.length > best.length)) best = item.href;
    }
  }
  return best;
}
