"use client";

/**
 * ListingReview: the side drawer where an admin reads everything about one listing before deciding.
 * Purpose: "Review listing" in the admin portal (S6-T04, FR-ADM-02): every photo, the state, the title and
 *   price, the facts, the sections (description, address, owner, a rejection's reason) and the decisions in a
 *   fixed footer. Owner: design system. It holds no state of its own: the page opens and closes it and
 *   passes the text, already translated, and what each button does. It sits on `Sheet`.
 * Props: open and onOpenChange, title (the drawer's name, "Review listing"), closeLabel, photosHeading,
 *   photos ({ src, alt }), noPhotosText (shown when there is none), badges (the kind and the status), heading
 *   (the listing's title), price, specs ({ id, label, value, missing }), sections ({ id, heading, body }),
 *   actions (the same buttons as the queue's rows; none for a listing nothing can be done to), className.
 *   `ReviewFacts` draws a list of name and value for a section such as the owner's.
 * Responsive: a drawer up to 540 px wide on the right, full height; the photos are two columns from 768 px and
 *   one on phones; the footer buttons wrap.
 * Accessibility: role dialog named by its title; focus moves in, is trapped and returns to the row's Review
 *   button; Escape and the close button close it. The scrolling body can take focus, so the keyboard can scroll it. The photos each have the alt text the page gives; the
 *   sections are headings in order (the drawer title is level 2, sections level 3, photos heading level 3).
 * States: open, closed; with photos, with one, with none; each state of the listing (pending, approved,
 *   featured, rejected with its reason, closed); a working button; missing facts; long text wraps.
 * Dependencies: Sheet, SpecTile, CardCover, Heading, QueueActionButtons, cn. Tests: listing-queue.test.tsx;
 *   Design Lab "Admin" (S6-T04).
 * UX reference: admin-listings screen, state "review" (drawer-side, specs, kv).
 */
import type { ReactNode } from "react";
import { SpecTile } from "@/components/patterns/spec-tile";
import { Sheet, SheetContent } from "@/components/patterns/sheet";
import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/cn";
import { QueueActionButtons, type QueueAction } from "./listing-queue";
import { CardCover } from "./property-card-controls.client";

/** The id that ties a section's heading to the section. */
const headingId = (id: string) => ["review", id].join("-");

type ReviewSpec = { id: string; label: string; value: ReactNode; missing?: boolean };
type ReviewSection = { id: string; heading: string; body: ReactNode };
type ReviewPhoto = { src: string; alt: string };

type ListingReviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  photosHeading: string;
  photos: ReviewPhoto[];
  noPhotosText: string;
  badges: ReactNode;
  heading: string;
  price: string;
  specs: ReviewSpec[];
  sections: ReviewSection[];
  actions: QueueAction[];
  className?: string;
};

function ListingReview({
  open,
  onOpenChange,
  title,
  closeLabel,
  photosHeading,
  photos,
  noPhotosText,
  badges,
  heading,
  price,
  specs,
  sections,
  actions,
  className,
}: ListingReviewProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        title={title}
        closeLabel={closeLabel}
        className={className}
        footer={
          actions.length > 0 ? (
            <QueueActionButtons actions={actions} className="w-full justify-end" />
          ) : undefined
        }
      >
        {/* Focusable so the keyboard can scroll the drawer when there is nothing else to tab to in it. */}
        <div
          data-slot="listing-review"
          role="group"
          aria-label={heading}
          tabIndex={0}
          className="flex flex-col gap-6"
        >
          <section aria-labelledby="review-photos" className="flex flex-col gap-3">
            <h3 id="review-photos" className="text-title-sm text-ink">
              {photosHeading}
            </h3>
            {photos.length === 0 ? (
              <div className="relative aspect-video overflow-hidden rounded-lg bg-canvas-sunken">
                <CardCover src={null} sizes="540px" />
                <p className="absolute inset-x-0 bottom-3 text-center text-small text-muted">
                  {noPhotosText}
                </p>
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {photos.map((photo, index) => (
                  <li
                    key={photo.src}
                    className={cn(
                      "relative aspect-video overflow-hidden rounded-lg bg-canvas-sunken",
                      index === 0 && photos.length > 1 && "md:col-span-2",
                    )}
                  >
                    <CardCover
                      src={photo.src}
                      alt={photo.alt}
                      sizes={index === 0 ? "540px" : "260px"}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">{badges}</div>
            <Heading as="h3" size="3" className="break-words">
              {heading}
            </Heading>
            <p className="text-title font-bold text-primary tabular-nums">{price}</p>
          </div>

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {specs.map((spec) => (
              <li key={spec.id} className="min-w-0">
                <SpecTile
                  label={spec.label}
                  value={spec.value}
                  {...(spec.missing ? { missing: true } : {})}
                />
              </li>
            ))}
          </ul>

          {sections.map((section) => (
            <section
              key={section.id}
              aria-labelledby={headingId(section.id)}
              className="flex flex-col gap-2"
            >
              <h3 id={headingId(section.id)} className="text-title-sm text-ink">
                {section.heading}
              </h3>
              <div className="text-small break-words text-muted">{section.body}</div>
            </section>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

type ReviewFactsProps = { rows: { id: string; name: string; value: ReactNode }[] };

/** A list of names and their values, such as the owner's name, email and when the listing was posted. */
function ReviewFacts({ rows }: ReviewFactsProps) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
      {rows.map((row) => (
        <div key={row.id} className="col-span-2 grid grid-cols-subgrid">
          <dt className="font-semibold text-ink">{row.name}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export { ListingReview, ReviewFacts };
export type { ListingReviewProps, ReviewPhoto, ReviewSection, ReviewSpec };
