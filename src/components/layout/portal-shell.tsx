/**
 * PortalShell: the frame of the admin and builder portals: sidebar, top bar and content area.
 * Purpose: one shell for both portals; only the navigation items differ. Owner: design system.
 * Props: brand (a Link around Logo with tone "on-dark"), portalTag (e.g. "Admin"), navLabel
 *   (required, already-translated), groups (PortalNavGroup list: optional heading, then items with
 *   label, href, icon, count, current), footerItems (items pinned to the bottom of the sidebar),
 *   topBar (the right side of the top bar: View site link, AvatarMenu), mobileMenu ({ triggerLabel,
 *   title, closeLabel }), mobileLogo (the logo shown in the top bar on phones), children (the page).
 * Responsive: below 768 px the sidebar becomes a drawer opened from the top bar; from 768 px it is
 *   a 76 px icon rail; from 1100 px it is the full 256 px sidebar.
 * Accessibility: the sidebar is a labelled nav; the current item has aria-current="page" and an
 *   edge mark; in the icon rail each item keeps its text as visually hidden text so it still has a
 *   name, and counts stay readable. Icon-only rail items need that name (it is there).
 * States: default, hover, focus, current. Dependencies: Sheet, IconButton, Link, Icon, cn.
 * Tests: layout.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-navigation, portal shell (c-nav.css .portal, .sidebar, .ptop).
 */
import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Link } from "@/components/ui/link";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/patterns/sheet";
import { cn } from "@/lib/cn";

type PortalNavItem = {
  label: string;
  href: string;
  icon: ReactNode;
  count?: number | string;
  current?: boolean;
};
type PortalNavGroup = { label?: string; items: PortalNavItem[] };

type PortalShellProps = {
  brand: ReactNode;
  portalTag?: string;
  navLabel: string;
  groups: PortalNavGroup[];
  footerItems?: PortalNavItem[];
  topBar?: ReactNode;
  mobileLogo?: ReactNode;
  mobileMenu: { triggerLabel: string; title: string; closeLabel: string };
  children: ReactNode;
};

function SidebarLink({ item, inDrawer }: { item: PortalNavItem; inDrawer: boolean }) {
  const link = (
    <Link
      href={item.href}
      current={item.current}
      className={cn(
        "relative flex h-11 items-center gap-3 rounded-md px-3 text-title-sm text-on-dark/90 no-underline",
        "transition-colors duration-(--dur-fast) hover:bg-dark-hover",
        "aria-[current=page]:bg-dark-active aria-[current=page]:text-on-dark aria-[current=page]:border-l-4 aria-[current=page]:border-l-on-dark-accent",
        !inDrawer && "md:max-portal:w-13 md:max-portal:justify-center md:max-portal:px-0",
      )}
    >
      <span className="shrink-0 text-on-dark-accent [&_svg]:size-5">{item.icon}</span>
      <span className={cn(!inDrawer && "md:max-portal:sr-only")}>{item.label}</span>
      {item.count !== undefined ? (
        <span
          className={cn(
            "ml-auto inline-grid h-5.5 min-w-5.5 place-items-center rounded-pill bg-cta px-2 text-caption font-bold text-on-cta",
            !inDrawer &&
              "md:max-portal:absolute md:max-portal:top-0.5 md:max-portal:right-0.5 md:max-portal:h-4.5 md:max-portal:min-w-4.5 md:max-portal:px-1 md:max-portal:text-caption",
          )}
        >
          {item.count}
        </span>
      ) : null}
    </Link>
  );
  return inDrawer ? <SheetClose asChild>{link}</SheetClose> : link;
}

function SidebarBody({
  props,
  inDrawer,
}: {
  props: Pick<PortalShellProps, "brand" | "portalTag" | "navLabel" | "groups" | "footerItems">;
  inDrawer: boolean;
}) {
  return (
    <nav aria-label={props.navLabel} className="flex h-full flex-col gap-1">
      <div
        className={cn(
          "flex items-center gap-2 px-2 pb-4",
          !inDrawer && "md:max-portal:justify-center md:max-portal:px-0",
        )}
      >
        <span className={cn(!inDrawer && "md:max-portal:hidden")}>{props.brand}</span>
        {props.portalTag ? (
          <span
            className={cn(
              "ml-auto rounded-pill bg-dark-active px-2 py-2 text-overline text-on-dark",
              !inDrawer && "md:max-portal:hidden",
            )}
          >
            {props.portalTag}
          </span>
        ) : null}
      </div>
      {props.groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.label ? (
            <p
              className={cn(
                "px-3 pt-4 pb-2 text-overline text-on-dark-muted",
                !inDrawer && "md:max-portal:sr-only",
              )}
            >
              {group.label}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} inDrawer={inDrawer} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {props.footerItems && props.footerItems.length > 0 ? (
        <ul className="mt-auto flex flex-col gap-1 border-t border-dark-line pt-4">
          {props.footerItems.map((item) => (
            <li key={item.href}>
              <SidebarLink item={item} inDrawer={inDrawer} />
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}

function PortalShell({ topBar, mobileLogo, mobileMenu, children, ...sidebar }: PortalShellProps) {
  return (
    <div
      data-slot="portal-shell"
      className="block min-h-screen md:grid md:grid-cols-[var(--rail-w)_minmax(0,1fr)] portal:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]"
    >
      <aside className="on-dark sticky top-0 hidden h-screen flex-col overflow-y-auto bg-dark px-3 pt-5 pb-4 text-on-dark md:flex md:max-portal:items-center md:max-portal:px-3">
        <SidebarBody props={sidebar} inDrawer={false} />
      </aside>
      <div className="min-w-0">
        <div className="sticky top-0 z-sticky flex h-16 items-center gap-3 border-b border-line bg-canvas/94 px-gutter backdrop-blur-md">
          <Sheet>
            <SheetTrigger asChild>
              <IconButton aria-label={mobileMenu.triggerLabel} className="text-primary md:hidden">
                <Icon icon={Menu} size="lg" />
              </IconButton>
            </SheetTrigger>
            <SheetContent
              side="right"
              title={mobileMenu.title}
              closeLabel={mobileMenu.closeLabel}
              tone="dark"
              className="max-w-80"
            >
              <SidebarBody props={sidebar} inDrawer />
            </SheetContent>
          </Sheet>
          <div className="md:hidden">{mobileLogo}</div>
          <div className="ml-auto flex items-center gap-3">{topBar}</div>
        </div>
        <main id="main" className="max-w-370 px-gutter pt-6 pb-18">
          {children}
        </main>
      </div>
    </div>
  );
}

export { PortalShell };
export type { PortalNavGroup, PortalNavItem };
