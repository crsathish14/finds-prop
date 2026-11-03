"use client";

/**
 * MobileDrawer: the navigation drawer for phones and tablets, opened by the menu button.
 * Purpose: holds the main navigation (which leaves the header below 1024 px), the account and
 *   workspace links, and the sign-in or Post property actions. Owner: design system.
 * Props: triggerLabel (required, already-translated, e.g. "Open menu"), title and closeLabel
 *   (required, already-translated), nav (NavItem list, shown large), groups (MenuGroup list with
 *   optional headings), actions (buttons at the bottom, such as Sign in and Post property),
 *   className.
 * Responsive: the menu button shows below 1024 px; the drawer is up to 380 px wide and at most
 *   90% of the screen.
 * Accessibility: a dialog named by its title, with focus kept inside and returned to the menu
 *   button on close; Escape closes it; choosing a link closes it. The current page has
 *   aria-current="page".
 * States: closed, open. Dependencies: Sheet, IconButton, Link, Icon.
 * Tests: layout.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-navigation, mobile drawer (c-nav.css .navdrawer).
 */
import { ChevronRight, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Link } from "@/components/ui/link";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/patterns/sheet";
import { cn } from "@/lib/cn";
import type { MenuGroup, NavItem } from "./nav-types";

type MobileDrawerProps = {
  triggerLabel: string;
  title: string;
  closeLabel: string;
  nav: NavItem[];
  groups?: MenuGroup[];
  actions?: ReactNode;
  className?: string;
};

function MobileDrawer({
  triggerLabel,
  title,
  closeLabel,
  nav,
  groups = [],
  actions,
  className,
}: MobileDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <IconButton aria-label={triggerLabel} className={cn("text-primary lg:hidden", className)}>
          <Icon icon={Menu} size="lg" />
        </IconButton>
      </SheetTrigger>
      <SheetContent
        side="right"
        title={title}
        closeLabel={closeLabel}
        className="max-w-95 bg-canvas"
      >
        <nav aria-label={title} className="flex min-h-full flex-col">
          <ul>
            {nav.map((item) => (
              <li key={`${item.href}|${item.label}`}>
                <SheetClose asChild>
                  <Link
                    href={item.href}
                    current={item.current}
                    className={cn(
                      "flex h-13.5 items-center justify-between border-b border-line font-display text-h3 text-primary no-underline",
                      "aria-[current=page]:border-l-4 aria-[current=page]:border-l-cta aria-[current=page]:pl-3 aria-[current=page]:font-semibold",
                      item.accent && "text-cta-text",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      {item.icon}
                      {item.label}
                    </span>
                    <Icon icon={ChevronRight} className="text-muted" />
                  </Link>
                </SheetClose>
              </li>
            ))}
          </ul>
          {groups.map((group, groupIndex) => (
            <div key={groupIndex} className="mt-5">
              {group.label ? (
                <p className="block pb-2 text-overline text-muted">{group.label}</p>
              ) : null}
              <ul>
                {group.items.map((entry) => (
                  <li key={entry.label}>
                    {entry.href ? (
                      <SheetClose asChild>
                        <Link
                          href={entry.href}
                          current={entry.current}
                          className="flex min-h-12 items-center gap-4 text-title-sm text-ink no-underline"
                        >
                          {entry.icon ? <span className="text-primary">{entry.icon}</span> : null}
                          {entry.label}
                          {entry.count !== undefined ? (
                            <span className="ml-auto inline-grid h-5.5 min-w-5.5 place-items-center rounded-pill bg-cta px-2 text-caption font-bold text-on-cta">
                              {entry.count}
                            </span>
                          ) : null}
                        </Link>
                      </SheetClose>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {actions ? <div className="mt-auto flex flex-col gap-3 pt-5">{actions}</div> : null}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export { MobileDrawer };
