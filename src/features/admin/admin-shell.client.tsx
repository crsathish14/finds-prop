"use client";

import {
  Building2,
  Briefcase,
  ChartColumn,
  ExternalLink,
  FileText,
  House,
  Image as ImageIcon,
  Inbox,
  Layers,
  LayoutDashboard,
  ListChecks,
  PanelBottom,
  PanelTop,
  Plug,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { PortalShell, type PortalNavGroup } from "@/components/layout/portal-shell";
import { Icon } from "@/components/ui/icon";
import { useClientPathname } from "@/lib/client-pathname";
import { currentNavHref, type AdminIconName, type AdminNavGroup } from "./nav";

const ICONS: Record<AdminIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  listings: ListChecks,
  projects: Building2,
  units: Layers,
  builders: Briefcase,
  leads: Inbox,
  forms: FileText,
  crm: Plug,
  header: PanelTop,
  hero: ImageIcon,
  homepage: House,
  footer: PanelBottom,
  insights: ChartColumn,
  profile: UserRound,
};

type AdminShellProps = {
  groups: AdminNavGroup[];
  viewSite: { label: string; href: string };
  labels: { nav: string; tag: string; menuOpen: string; menuTitle: string; menuClose: string };
  brand: ReactNode;
  mobileLogo: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
};

/**
 * The portal frame of the admin and of a builder (S7-T03): the shared PortalShell with the navigation it is given,
 * marking the page the person is on. The
 * mark is filled in once the page is hydrated (`useClientPathname`), because a page reached through the language
 * rewrite has a different path on the server and on first load in the browser (repo-gotchas). The sidebar's words
 * and numbers arrive ready from the server; this only chooses the icon of each link and the current one.
 */
export function AdminShell({
  groups,
  viewSite,
  labels,
  brand,
  mobileLogo,
  topBar,
  children,
}: AdminShellProps) {
  const current = currentNavHref(groups, useClientPathname());
  const navGroups: PortalNavGroup[] = groups.map((group) => ({
    ...(group.label ? { label: group.label } : {}),
    items: group.items.map((item) => ({
      label: item.label,
      href: item.href,
      icon: <Icon icon={ICONS[item.icon]} />,
      ...(item.count !== undefined ? { count: item.count } : {}),
      ...(item.href === current ? { current: true } : {}),
    })),
  }));
  return (
    <PortalShell
      brand={brand}
      portalTag={labels.tag}
      navLabel={labels.nav}
      groups={navGroups}
      footerItems={[
        { label: viewSite.label, href: viewSite.href, icon: <Icon icon={ExternalLink} /> },
      ]}
      mobileLogo={mobileLogo}
      mobileMenu={{
        triggerLabel: labels.menuOpen,
        title: labels.menuTitle,
        closeLabel: labels.menuClose,
      }}
      topBar={topBar}
    >
      {children}
    </PortalShell>
  );
}
