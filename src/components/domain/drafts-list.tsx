/**
 * DraftsList: the listings someone has started and not sent, each with Continue and Delete.
 * Purpose: "Your drafts" above a new listing on the post-property page (S6-T02, FR-ACC-08). Owner: design
 *   system. It holds no state: the page passes the rows and what Delete does, already translated.
 * Props: heading (already translated), headingAs (heading level, "h2" by default), items ({ id, title,
 *   meta, updated, continueHref, continueText, continueFor, deleteText, deleteFor, onDelete, pending }),
 *   className. `title` is the listing's own title, or the page's "Untitled draft" when it has none.
 * Responsive: the text above the buttons on phones; text and buttons on one line from 768 px. A long
 *   title is cut after two lines.
 * Accessibility: a list; the Continue link and the Delete button have a visible word followed by hidden
 *   text naming the draft ("Continue 3 BHK apartment"), so several of them on one page are told apart;
 *   a draft that is being deleted keeps its row and disables its buttons.
 * States: one draft, several, long title, no title, deleting. Dependencies: Button, Link, Heading,
 *   VisuallyHidden, cn. Tests: wizard.test.tsx; Design Lab "Seller" (S6-T02).
 * UX reference: draft saving (post-property "Save draft" toast: "Pick up where you left off").
 */
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Link } from "@/components/ui/link";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type DraftItem = {
  id: string;
  title: string;
  /** Under the title, such as "For sale · Apartment · Velachery". */
  meta: string;
  /** When it was last changed, such as "Saved 12 Oct". */
  updated: string;
  continueHref: string;
  continueText: string;
  continueFor: string;
  deleteText: string;
  deleteFor: string;
  onDelete: () => void;
  pending?: boolean;
};

type DraftsListProps = {
  heading: ReactNode;
  headingAs?: "h2" | "h3";
  items: DraftItem[];
  className?: string;
};

function DraftsList({ heading, headingAs = "h2", items, className }: DraftsListProps) {
  return (
    <section data-slot="drafts-list" className={cn("flex flex-col gap-3", className)}>
      <Heading as={headingAs} size="3">
        {heading}
      </Heading>
      <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="line-clamp-2 font-bold break-words text-ink">{item.title}</p>
              <p className="text-small text-muted">{item.meta}</p>
              <p className="text-caption text-subtle">{item.updated}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={item.continueHref}
                  className="no-underline"
                  {...(item.pending ? { "aria-disabled": true, tabIndex: -1 } : {})}
                >
                  {item.continueText} <VisuallyHidden>{item.continueFor}</VisuallyHidden>
                </Link>
              </Button>
              <Button
                type="button"
                variant="danger-outline"
                size="sm"
                loading={item.pending ?? false}
                onClick={item.onDelete}
              >
                {item.deleteText} <VisuallyHidden>{item.deleteFor}</VisuallyHidden>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export { DraftsList };
export type { DraftItem, DraftsListProps };
