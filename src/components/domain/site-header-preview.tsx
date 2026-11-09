/**
 * SiteHeaderPreview: a small drawing of the public header (the name, the links and the button) for the admin's Header
 * page.
 * Purpose: shows, beside the boxes, how the header will read once the changes are saved (S7-T10, FR-ADM-10). Owner:
 *   design system. It is a picture, not a header: nothing in it can be clicked, and it is hidden from screen readers
 *   (the boxes beside it say the same things). The page works out what the header will show with the same rules the
 *   public header uses, and passes the result in.
 * Props: brandName, links (the labels, in order), cta (the button's label, left out when there is no button),
 *   className.
 * Responsive: the name, the links and the button wrap onto more lines in a narrow column.
 * Accessibility: aria-hidden; the real header is read in the public pages.
 * States: with links and a button, with links only, with no links.
 * Dependencies: Logo, cn. Tests: site-content-parts.test.tsx; Design Lab "Admin" (S7-T10).
 * UX reference: admin-cms screen (the header preview card).
 */
import { Logo } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

type SiteHeaderPreviewProps = {
  brandName: string;
  links: readonly string[];
  cta?: string;
  className?: string;
};

function SiteHeaderPreview({ brandName, links, cta, className }: SiteHeaderPreviewProps) {
  return (
    <div
      aria-hidden="true"
      data-slot="site-header-preview"
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-canvas px-4 py-2",
        className,
      )}
    >
      <Logo name={brandName} />
      {links.map((label, index) => (
        // The same label can appear twice in a list the admin is still editing, so the place is part of the key.
        <span key={`${index}-${label}`} className="text-small font-semibold text-ink">
          {label}
        </span>
      ))}
      {cta ? (
        <span className="ml-auto rounded-pill border border-line-strong px-4 py-2 text-small font-semibold text-primary">
          {cta}
        </span>
      ) : null}
    </div>
  );
}

export { SiteHeaderPreview };
export type { SiteHeaderPreviewProps };
