/**
 * SiteHomepagePreview: a small drawing of the public home page for the admin's Homepage page: the sections that are on
 * or off, the Popular chips of the search card and the Explore by locality tiles.
 * Purpose: shows, beside the boxes, what the home page will contain once the changes are saved (S7-T10, FR-ADM-10,
 *   ADD-11). Owner: design system. It is a picture, not the page: nothing in it can be clicked, and it is hidden from
 *   screen readers (the boxes beside it say the same things). The page works out the lists with the same rules the
 *   home page uses (the first four localities are the chips; a section with nothing to show is left out) and passes
 *   the words, already translated.
 * Props: sections ({ label, on }[], in the order of the page), popular (the chips' labels), tiles (the tiles' labels),
 *   hiddenNote ({ title, text }: shown instead of the lists when there are no localities), words ({ popular, explore,
 *   on, off }), className.
 * Responsive: the tiles wrap onto as many lines as they need in the narrow column.
 * Accessibility: aria-hidden; the real page is read on the home page. An off section shows the word Off and a dashed
 *   edge, so the state is not shown by colour alone; it is not dimmed, because dimmed text fails the contrast rule.
 * States: all on, some off, with localities, without (the note).
 * Dependencies: Icon, cn. Tests: site-content-parts.test.tsx; Design Lab "Site content" (S7-T10).
 * UX reference: admin-cms screen (the homepage preview card) and admin-localities screen (the preview card).
 */
import { Info } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type SiteHomepagePreviewProps = {
  sections: readonly { label: string; on: boolean }[];
  popular: readonly string[];
  tiles: readonly string[];
  hiddenNote: { title: string; text: string };
  words: { popular: string; explore: string; on: string; off: string };
  className?: string;
};

function SiteHomepagePreview({
  sections,
  popular,
  tiles,
  hiddenNote,
  words,
  className,
}: SiteHomepagePreviewProps) {
  return (
    <div
      aria-hidden="true"
      data-slot="site-homepage-preview"
      className={cn("flex flex-col gap-4", className)}
    >
      <ul className="flex flex-col gap-2">
        {sections.map((section, index) => (
          <li
            key={`${index}-${section.label}`}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2 text-small",
              section.on ? "font-semibold text-ink" : "border-dashed text-muted",
            )}
          >
            <span className="min-w-0 break-words">{section.label}</span>
            <span
              className={cn(
                "shrink-0 rounded-pill px-2 py-1 text-caption font-bold",
                section.on
                  ? "bg-success-tint text-success"
                  : "border border-line-strong bg-surface text-muted",
              )}
            >
              {section.on ? words.on : words.off}
            </span>
          </li>
        ))}
      </ul>
      {tiles.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-caption text-muted">{words.popular}</p>
          <ul className="flex flex-wrap gap-2">
            {popular.map((label, index) => (
              <li
                key={`${index}-${label}`}
                className="rounded-pill border border-line-strong bg-surface px-3 py-1 text-caption font-semibold text-ink"
              >
                {label}
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted">{words.explore}</p>
          <ul className="grid grid-cols-2 gap-2">
            {tiles.map((label, index) => (
              <li
                key={`${index}-${label}`}
                className="flex h-14 items-end rounded-md bg-primary-tint px-3 py-2 text-small font-semibold break-words text-primary"
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-line bg-canvas-sunken p-3 text-small">
          <Icon icon={Info} size="sm" className="mt-1 shrink-0 text-muted" />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-bold text-ink">{hiddenNote.title}</p>
            <p className="text-muted">{hiddenNote.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export { SiteHomepagePreview };
export type { SiteHomepagePreviewProps };
