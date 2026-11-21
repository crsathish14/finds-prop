/**
 * BottomBar: the five-item navigation bar fixed to the bottom of the screen on phones.
 * Purpose: Home, Search, Post, Saved and Me within thumb reach. The middle "Post" item is the one
 *   raised action. While the AI chat is on (ADD-17) it is Home, Search, AI, Post and Me instead: the
 *   centre AI item is a copper-tint disc (`accent`) and Post is a normal item. Owner: design system. Signed-out visitors get sign-in links for Saved and Me
 *   (the caller sets the hrefs). Show it only on the pages the UX lists.
 * Props: navLabel (required, already-translated), items ({ label, href, icon, current?, badge?,
 *   raised?, accent?, ariaLabel? }, five of them; ariaLabel is the spoken name when the short label,
 *   such as "AI", is not enough), className. A badge is a small copper count, e.g. saved homes.
 * Responsive: phones only; it disappears from 768 px. Pages that show it add the
 *   class pb-bottombar (and md:pb-0) so the bar does not cover the last content.
 * Accessibility: a nav landmark; the current item has aria-current="page" and a copper tick, so
 *   it is not only colour (the AI disc also gets an outline border). Each item is at least 44 px wide and tall.
 *   The AI disc gets the AI motion (AiCta "disc": sparkle and glow; see src/styles/ai-cta.css).
 *   A badge is part of the name.
 * States: default, current, hover, focus. Dependencies: Link, Icon, cn.
 * Tests: layout.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-navigation, bottom bar (c-nav.css .bottombar).
 */
import type { ReactNode } from "react";
import { AiCta } from "@/components/ui/ai-cta.client";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";

type BottomBarItem = {
  label: string;
  href: string;
  icon: ReactNode;
  current?: boolean;
  badge?: number | string;
  raised?: boolean;
  /** The copper-tint AI disc (ADD-17). Not a copper fill, so the one-copper-button rule holds. */
  accent?: boolean;
  /** The spoken name when it differs from the label. */
  ariaLabel?: string;
};

type BottomBarProps = { navLabel: string; items: BottomBarItem[]; className?: string };

function BottomBar({ navLabel, items, className }: BottomBarProps) {
  return (
    <nav
      aria-label={navLabel}
      data-slot="bottom-bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-sticky h-(--bottombar-h) border-t border-line bg-surface px-1 pt-2 pb-3 md:hidden",
        className,
      )}
    >
      <ul className="grid h-full grid-cols-5">
        {items.map((item) => {
          const link = (
            <Link
              href={item.href}
              current={item.current}
              {...(item.ariaLabel ? { "aria-label": item.ariaLabel } : {})}
              className={cn(
                "relative flex h-full flex-col items-center justify-center gap-1 rounded-md text-caption leading-none font-semibold text-muted no-underline",
                item.accent && "font-bold text-cta-text aria-[current=page]:text-cta-text",
                "aria-[current=page]:font-bold aria-[current=page]:text-primary aria-[current=page]:before:absolute aria-[current=page]:before:-top-1.5 aria-[current=page]:before:h-0.75 aria-[current=page]:before:w-6 aria-[current=page]:before:rounded-b-xs aria-[current=page]:before:bg-cta aria-[current=page]:before:content-['']",
              )}
            >
              <span
                className={cn(
                  "grid place-items-center [&_svg]:size-6",
                  item.raised &&
                    "-my-1 size-9 rounded-pill bg-primary text-on-primary [&_svg]:size-5",
                  item.accent &&
                    "ai-cta__disc -my-1 size-8.5 rounded-pill bg-cta-tint-2 text-cta-text [&_svg]:size-5",
                  item.accent && item.current && "border-2 border-cta-text",
                )}
              >
                {item.icon}
              </span>
              {item.label}
              {item.badge !== undefined ? (
                <span className="absolute top-0.75 left-[calc(50%+var(--s-2))] min-w-4.5 rounded-pill bg-cta px-1 text-center text-caption leading-4.5 font-bold text-on-cta">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
          return (
            <li key={item.href} className="min-w-0">
              {item.accent ? (
                <AiCta name="nav" variant="disc">
                  {link}
                </AiCta>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export { BottomBar };
export type { BottomBarItem };
