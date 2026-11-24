/**
 * SiteFooter: the dark footer: brand, link columns, contact details and the legal line.
 * Purpose: the one footer for every public page. Owner: design system. Its content is managed in
 *   the admin footer settings, so the caller passes everything in.
 * Props: logo (a Link around Logo with tone "on-dark"), about (the short description), columns
 *   ({ heading, links: { label, href, external? }[] }), contacts ({ icon, text, href? }[], the
 *   address, phone and email lines), contactHeading (a small heading over the contact lines, phones only), disclaimer (plain text the super admin writes, shown above the legal line; none
 *   when empty), legal ({ copyright, links }), navLabel (required, already-
 *   translated, names the link columns), className.
 * Link columns: each group's links are spread over up to 3 columns of at most 6 links (spread-links.ts); links past
 *   the 18th are not shown.
 * Responsive: one column on phones, links in one list and the contact lines set apart under a rule and a heading;
 *   brand, links and contact side by side from 768 px.
 * Accessibility: a contentinfo landmark; the link columns are in a labelled nav; every link is at
 *   least 44 px tall including its padding.
 * States: default, hover, focus (the focus ring switches to the light copper on dark surfaces).
 * Dependencies: Container, Link, cn. Tests: layout.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: ds-navigation, footer (c-nav.css .ftr).
 */
import type { ReactNode } from "react";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { Container } from "./container";
import { spreadLinks } from "./spread-links";

type FooterLink = { label: string; href: string; external?: boolean; newTabLabel?: string };
type FooterColumn = { heading: string; links: FooterLink[] };
type FooterContact = { icon: ReactNode; text: string; href?: string };

type SiteFooterProps = {
  logo: ReactNode;
  about?: string;
  navLabel: string;
  columns: FooterColumn[];
  contacts?: FooterContact[];
  contactHeading?: string;
  disclaimer?: string;
  legal: { copyright: string; links?: FooterLink[] };
  className?: string;
};

const SUBLIST_GRID = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
} as const;

const LINK_STYLES =
  "inline-flex items-center gap-2 py-2 text-body font-medium text-on-dark/90 no-underline hover:text-on-dark hover:underline hover:underline-offset-4";

function FooterLinkItem({ link }: { link: FooterLink }) {
  return link.external && link.newTabLabel ? (
    <Link href={link.href} external newTabLabel={link.newTabLabel} className={LINK_STYLES}>
      {link.label}
    </Link>
  ) : (
    <Link href={link.href} className={LINK_STYLES}>
      {link.label}
    </Link>
  );
}

function SiteFooter({
  logo,
  about,
  navLabel,
  columns,
  contacts = [],
  contactHeading,
  disclaimer,
  legal,
  className,
}: SiteFooterProps) {
  return (
    <footer data-slot="site-footer" className={cn("on-dark bg-dark text-on-dark", className)}>
      <Container className="pt-10 pb-6 md:pt-14 md:pb-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.2fr_2.6fr_1.2fr] md:gap-10">
          <div>
            {logo}
            {about ? (
              <p className="mt-4 max-w-[38ch] text-body text-on-dark-muted">{about}</p>
            ) : null}
          </div>
          <nav aria-label={navLabel} className="flex flex-col gap-6 md:flex-row md:gap-10">
            {columns.map((column) => {
              const sublists = spreadLinks(column.links);
              const gridClass = SUBLIST_GRID[Math.max(1, sublists.length) as 1 | 2 | 3];
              return (
                <div key={column.heading} className="md:flex-1">
                  <h2 className="mb-3 text-overline text-on-dark-accent">{column.heading}</h2>
                  <div className={cn("grid grid-cols-1 gap-x-6", gridClass)}>
                    {sublists.map((sublist) => (
                      <ul key={sublist[0]?.href}>
                        {sublist.map((link) => (
                          <li key={link.href}>
                            <FooterLinkItem link={link} />
                          </li>
                        ))}
                      </ul>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          {contacts.length > 0 ? (
            <div className="border-t border-dark-line pt-6 md:border-t-0 md:pt-0">
              {contactHeading ? (
                <h2 className="mb-3 text-overline text-on-dark-accent md:hidden">
                  {contactHeading}
                </h2>
              ) : null}
              <ul>
                {contacts.map((contact) => (
                  <li
                    key={contact.text}
                    className="flex items-start gap-3 py-2 text-body font-medium text-on-dark/90"
                  >
                    <span className="mt-1 shrink-0 text-on-dark-accent [&_svg]:size-5">
                      {contact.icon}
                    </span>
                    {contact.href ? (
                      <Link
                        href={contact.href}
                        className="text-on-dark/90 no-underline hover:underline"
                      >
                        {contact.text}
                      </Link>
                    ) : (
                      contact.text
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {disclaimer ? (
          <p
            data-slot="site-footer-disclaimer"
            className="mt-10 max-w-[90ch] text-small whitespace-pre-line text-on-dark-muted"
          >
            {disclaimer}
          </p>
        ) : null}
        <div
          className={cn(
            "flex flex-wrap justify-between gap-x-6 gap-y-3 border-t border-dark-line pt-5 text-small text-on-dark-muted",
            disclaimer ? "mt-5" : "mt-10",
          )}
        >
          <p>{legal.copyright}</p>
          {legal.links && legal.links.length > 0 ? (
            <ul className="flex flex-wrap gap-x-6 gap-y-1">
              {legal.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="py-2 text-small font-normal text-on-dark-muted no-underline hover:text-on-dark hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}

export { SiteFooter };
export type { FooterColumn, FooterContact, FooterLink };
