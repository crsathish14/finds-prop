/**
 * SiteContentLayout: the frame of the four Site content pages: the heading, the page tabs, the form beside a live
 * preview, and the save bar.
 * Purpose: one frame for Header, Hero, Homepage and Footer in the admin (S7-T10, FR-ADM-10). Owner: design system. It
 *   holds nothing: the page puts the form sections, the preview and the save bar in its slots and passes the words,
 *   already translated.
 * Props: title, description (the page heading and its line), tabs ({ key, label, href, current }[]; the four pages,
 *   each a link), tabsLabel (names the tabs), previewLabel (names the preview and is shown above it), preview (what the
 *   preview draws), top (an alert about errors, optional), children (the form sections), footer (the save bar),
 *   headingLevel ("h1" default | "h2", for a page that already has an h1, such as the Design Lab), className.
 * Responsive: one column up to 1100 px of screen: the tabs scroll sideways, the preview sits under the form. From
 *   1100 px the preview takes a column on the right and stays in view while the form scrolls.
 * Accessibility: a named navigation of links with aria-current on the page the admin is on; the preview is a named
 *   region. The order in the page is the reading order: heading, tabs, alert, form, preview, save bar.
 * States: any of the four tabs current; with and without the alert.
 * Dependencies: Heading, Text, Link, cn. Tests: site-content-parts.test.tsx; Design Lab "Site content" (S7-T10).
 * UX reference: admin-cms screen (.phead, .ptabs, .cms-grid, .preview-card).
 */
import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type SiteContentTab = { key: string; label: string; href: string; current: boolean };

type SiteContentLayoutProps = {
  title: string;
  description: string;
  tabs: readonly SiteContentTab[];
  tabsLabel: string;
  previewLabel: string;
  preview: ReactNode;
  top?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  headingLevel?: "h1" | "h2";
  className?: string;
};

function SiteContentLayout({
  title,
  description,
  tabs,
  tabsLabel,
  previewLabel,
  preview,
  top,
  children,
  footer,
  headingLevel = "h1",
  className,
}: SiteContentLayoutProps) {
  return (
    <div data-slot="site-content-layout" className={cn("flex min-w-0 flex-col gap-6", className)}>
      <header className="flex flex-col gap-1">
        <Heading as={headingLevel} size="1">
          {title}
        </Heading>
        <Text tone="muted">{description}</Text>
      </header>
      <nav aria-label={tabsLabel} className="border-b border-line-strong">
        <ul className="flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <li key={tab.key} className="flex-none">
              <Link
                href={tab.href}
                current={tab.current}
                className={cn(
                  "relative inline-flex h-(--size-tab) items-center px-1 text-title-sm whitespace-nowrap text-muted no-underline",
                  "hover:text-primary aria-[current=page]:text-primary",
                  "after:absolute after:inset-x-0 after:bottom-0 after:h-0.75 after:content-['']",
                  "aria-[current=page]:after:bg-cta",
                )}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {top}
      <div className="flex min-w-0 flex-col gap-6 portal:flex-row portal:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
        <section
          aria-label={previewLabel}
          className="flex min-w-0 flex-col gap-3 rounded-xl border border-line bg-canvas-sunken p-4 portal:sticky portal:top-6 portal:w-80 portal:shrink-0"
        >
          <p className="text-overline text-muted" aria-hidden="true">
            {previewLabel}
          </p>
          {preview}
        </section>
      </div>
      {footer}
    </div>
  );
}

export { SiteContentLayout };
export type { SiteContentLayoutProps, SiteContentTab };
