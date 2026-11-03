/**
 * SiteHeader: the public header: logo, main navigation, and the account actions.
 * Purpose: the one header for every public page. Owner: design system. What it shows comes from
 *   the caller (the site menu is managed in the admin site settings, and the right side depends on
 *   the signed-in role), so this component only lays it out.
 * Props: logo (a Link around Logo, with its own aria-label), navLabel (required, already-
 *   translated), nav (NavItem list), actions (the right side: Sign in link, Post property button,
 *   icon buttons, AvatarMenu), menu (the MobileDrawer, shown below 1024 px), bordered (hairline
 *   under the header, used once the page has scrolled past the hero), className.
 * Responsive: 56, 64 and 72 px tall by breakpoint (the --header-h token). Below 1024 px the nav
 *   moves into the drawer and the menu button shows.
 * Accessibility: a banner landmark with a labelled nav; the current page has aria-current="page"
 *   and a copper underline. It stays at the top while the page scrolls (sticky).
 * States: default, bordered; each link has hover, focus and current.
 * Dependencies: Container, Link, cn. Tests: layout.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-navigation, public header (c-nav.css .hdr, .nav).
 */
import type { ReactNode } from "react";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { Container } from "./container";
import type { NavItem } from "./nav-types";

type SiteHeaderProps = {
  logo: ReactNode;
  navLabel: string;
  nav: NavItem[];
  actions?: ReactNode;
  menu?: ReactNode;
  bordered?: boolean;
  className?: string;
};

function SiteHeader({
  logo,
  navLabel,
  nav,
  actions,
  menu,
  bordered = false,
  className,
}: SiteHeaderProps) {
  return (
    <header
      data-slot="site-header"
      className={cn(
        "sticky top-0 z-header h-(--header-h) border-b bg-canvas/94 backdrop-blur-md",
        bordered ? "border-line" : "border-transparent",
        className,
      )}
    >
      <Container className="flex h-full items-center gap-3 lg:gap-10">
        {logo}
        <nav aria-label={navLabel} className="hidden lg:block">
          <ul className="flex gap-6 xl:gap-8">
            {nav.map((item) => (
              <li key={`${item.href}|${item.label}`}>
                <Link
                  href={item.href}
                  current={item.current}
                  variant="nav"
                  className={cn(
                    "relative inline-flex items-center gap-2 py-3 text-body font-medium whitespace-nowrap",
                    "aria-[current=page]:font-bold aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-pill aria-[current=page]:after:bg-cta aria-[current=page]:after:content-['']",
                    item.accent && "font-semibold text-cta-text hover:text-cta-hover",
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1 md:gap-3">{actions}</div>
        {menu}
      </Container>
    </header>
  );
}

export { SiteHeader };
