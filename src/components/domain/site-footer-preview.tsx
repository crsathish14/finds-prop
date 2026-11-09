/**
 * SiteFooterPreview: a small drawing of the public footer (the name, the about text, the contact lines, the links and
 * the copyright line) for the admin's Footer page.
 * Purpose: shows, beside the boxes, how the footer will read once the changes are saved (S7-T10, FR-ADM-10). Owner:
 *   design system. It is a picture, not a footer: nothing in it can be clicked, and it is hidden from screen readers
 *   (the boxes beside it say the same things). The page works out what the footer will show with the same rules the
 *   public footer uses, and passes the result in.
 * Props: brandName, about (left out when empty), contacts (the lines as shown: address, phone, email), links (the
 *   labels, in order), copyright, className.
 * Responsive: one column; long lines wrap.
 * Accessibility: aria-hidden; the real footer is read in the public pages.
 * States: full, with only a copyright line.
 * Dependencies: Logo, cn. Tests: site-content-parts.test.tsx; Design Lab "Admin" (S7-T10).
 * UX reference: admin-cms screen (the footer preview card, the dark card).
 */
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

type SiteFooterPreviewProps = {
  brandName: string;
  about?: string;
  contacts: readonly string[];
  links: readonly string[];
  copyright: string;
  className?: string;
};

function SiteFooterPreview({
  brandName,
  about,
  contacts,
  links,
  copyright,
  className,
}: SiteFooterPreviewProps) {
  return (
    <div
      aria-hidden="true"
      data-slot="site-footer-preview"
      className={cn("on-dark flex flex-col gap-3 rounded-xl bg-dark p-4 text-on-dark", className)}
    >
      <Logo name={brandName} tone="on-dark" />
      {about ? <p className="text-small whitespace-pre-line text-on-dark-muted">{about}</p> : null}
      {contacts.length > 0 ? (
        <ul className="flex flex-col gap-1 text-small text-on-dark/90">
          {contacts.map((line, index) => (
            <li key={`${index}-${line}`} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {links.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-small font-medium text-on-dark/90">
          {links.map((label, index) => (
            <li key={`${index}-${label}`}>{label}</li>
          ))}
        </ul>
      ) : null}
      <p className="border-t border-dark-line pt-3 text-caption text-on-dark-muted">{copyright}</p>
    </div>
  );
}

export { SiteFooterPreview };
export type { SiteFooterPreviewProps };
