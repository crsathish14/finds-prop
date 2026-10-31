/**
 * Breadcrumb: the trail back up the site: Home > Properties > Velachery.
 * Purpose: wayfinding on detail and listing pages. Owner: design system.
 * Props: items ({ label, href? } in order; the last one is the current page and has no link),
 *   navLabel (required, already-translated, e.g. "Breadcrumb"), backLabel (required, already-
 *   translated link text for the parent page on small screens, e.g. "Back to Properties"), className.
 * Responsive: from 1024 px the full trail; below that a single back link to the parent page.
 * Accessibility: a nav landmark with an ordered list; aria-current="page" on the last item.
 * States: default, hover, focus. Dependencies: Link, Icon.
 * Tests: display.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-navigation, breadcrumb (c-nav.css .crumbs).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";

type BreadcrumbItem = { label: string; href?: string };

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  navLabel: string;
  backLabel: string;
  className?: string;
};

function Breadcrumb({ items, navLabel, backLabel, className }: BreadcrumbProps) {
  const parent = items.slice(0, -1).findLast((item) => item.href);
  return (
    <nav aria-label={navLabel} data-slot="breadcrumb" className={className}>
      {parent?.href ? (
        <Link
          href={parent.href}
          className="inline-flex min-h-(--size-touch-min) items-center gap-1 text-small font-semibold text-muted no-underline lg:hidden"
        >
          <Icon icon={ChevronLeft} size="sm" />
          {backLabel}
        </Link>
      ) : null}
      <ol
        className={cn(
          "flex-wrap items-center gap-x-2 gap-y-1 text-small text-muted",
          parent?.href ? "hidden lg:flex" : "flex",
        )}
      >
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li>
                {last || !item.href ? (
                  <span aria-current={last ? "page" : undefined} className="font-semibold text-ink">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="py-1 font-normal text-muted no-underline hover:text-primary hover:underline"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
              {last ? null : (
                <li aria-hidden="true" className="text-line-input">
                  <Icon icon={ChevronRight} size="sm" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumb };
export type { BreadcrumbItem };
