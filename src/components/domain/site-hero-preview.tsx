/**
 * SiteHeroPreview: a small drawing of the public home page's hero (the eyebrow, the headline, the line under it and the
 * search) in the chosen layout, for the admin's Hero page.
 * Purpose: shows, beside the boxes, how the hero will read and be arranged once the changes are saved (S7-T10,
 *   FR-ADM-10, FR-ADM-11). Owner: design system. It is a picture, not the hero: nothing in it can be clicked, and it
 *   is hidden from screen readers (the boxes beside it say the same things). The page works out the words with the same
 *   rules the home page uses (the standard headline when none is saved) and passes them in. The banner is drawn as a
 *   plain stand-in: which sponsor shows is chosen elsewhere.
 * Props: title, subtitle (left out when empty), eyebrow (left out when empty; shown in the Split layout only, as on the
 *   home page), layout ("search_desk" | "split"), className.
 * Responsive: fills the preview column; the Split drawing keeps the text on the left and the banner on the right.
 * Accessibility: aria-hidden; the real hero is read on the home page.
 * States: Search Desk, Split, with and without an eyebrow and a subtitle.
 * Dependencies: cn. Tests: site-content-parts.test.tsx; Design Lab "Admin" (S7-T10).
 * UX reference: admin-cms screen (the hero preview card).
 */
import { cn } from "@/lib/cn";

type SiteHeroPreviewProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  layout: "search_desk" | "split";
  className?: string;
};

function SiteHeroPreview({ title, subtitle, eyebrow, layout, className }: SiteHeroPreviewProps) {
  const split = layout === "split";
  const search = (
    <span className="mt-1 block h-10 w-full rounded-md border border-line-input bg-surface" />
  );
  return (
    <div
      aria-hidden="true"
      data-slot="site-hero-preview"
      data-layout={layout}
      className={cn(
        "flex gap-3 rounded-xl border border-line bg-canvas p-4",
        split ? "flex-col" : "flex-col text-center",
        className,
      )}
    >
      <div className={cn("flex min-w-0 gap-3", split ? "flex-row items-stretch" : "flex-col")}>
        <div className={cn("flex min-w-0 flex-col gap-2", split && "flex-1")}>
          {split && eyebrow ? (
            <p className="text-overline text-cta-text break-words">{eyebrow}</p>
          ) : null}
          <p className="text-h3 break-words text-primary">{title}</p>
          {subtitle ? <p className="text-small break-words text-muted">{subtitle}</p> : null}
          {search}
        </div>
        {split ? (
          <span className="block w-2/5 shrink-0 rounded-md bg-cta-tint" />
        ) : (
          <span className="mx-auto block h-3 w-4/5 rounded-sm bg-cta-tint" />
        )}
      </div>
    </div>
  );
}

export { SiteHeroPreview };
export type { SiteHeroPreviewProps };
