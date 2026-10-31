/**
 * SiteFooter: the dark footer: brand, link columns, contact details and the legal line.
 * Purpose: the one footer for every public page. Owner: design system. Its content is managed in
 *   the admin footer settings, so the caller passes everything in.
 * Props: logo (a Link around Logo with tone "on-dark"), about (the short description), columns
 *   ({ heading, links: { label, href, external? }[] }), contacts ({ icon, text, href? }[], the
 *   address, phone and email lines), legal ({ copyright, links }), navLabel (required, already-
 *   translated, names the link columns), className.
 * Responsive: one column on phones with the link columns two across; four columns from 768 px.
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

type FooterLink = { label: string; href: string; external?: boolean; newTabLabel?: string };
type FooterColumn = { heading: string; links: FooterLink[] };
type FooterContact = { icon: ReactNode; text: string; href?: string };

type SiteFooterProps = {
  logo: ReactNode;
  about?: string;
  navLabel: string;
  columns: FooterColumn[];
  contacts?: FooterContact[];
  legal: { copyright: string; links?: FooterLink[] };
  className?: string;
};

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
  legal,
  className,
}: SiteFooterProps) {
  return (
    <footer data-slot="site-footer" className={cn("on-dark bg-dark text-on-dark", className)}>
      <Container className="pt-10 pb-6 md:pt-14 md:pb-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] md:gap-10">
          <div>
            {logo}
            {about ? (
              <p className="mt-4 max-w-[38ch] text-body text-on-dark-muted">{about}</p>
            ) : null}
          </div>
          <nav
            aria-label={navLabel}
            className="grid grid-cols-2 gap-x-4 gap-y-6 md:col-span-2 md:gap-10"
          >
            {columns.map((column) => (
              <div key={column.heading}>
                <h2 className="mb-3 text-overline text-on-dark-accent">{column.heading}</h2>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <FooterLinkItem link={link} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          {contacts.length > 0 ? (
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
          ) : null}
        </div>
        <div className="mt-10 flex flex-wrap justify-between gap-x-6 gap-y-3 border-t border-dark-line pt-5 text-small text-on-dark-muted">
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
