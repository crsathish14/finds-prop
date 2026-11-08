/**
 * MyListingRow: one of the owner's listings on the dashboard, with its state and what can be done to it.
 * Purpose: a line of "My listings" (S6-T03, FR-ACC-09 to FR-ACC-12): the picture, the title (a link while the
 *   listing is Live), the price, place and when it was posted, the kind of listing, the state as a badge, a note
 *   under it when the state needs one (waiting for review, or why it was not approved), and the buttons for
 *   that state (Mark as sold or rented, Delete). Owner: design system. It holds no state: the page passes the
 *   text, already translated, and what each button does. `MyListingsList` is the list around the rows.
 * Props: title, href (the public page, only while Live; otherwise the title is plain text), cover
 *   { src, alt }, price, place, posted (such as "Posted 2 days ago"), kind (such as "For sale"), status (a
 *   StatusBadge), note ({ tone "waiting" | "rejected", text }), actions (the same buttons as the admin's rows:
 *   { id, label, forName, tone, icon, onClick, pending }; `forName` is the listing's title, heard after the
 *   visible word), className. MyListingsList: label (names the list), footnote (a line under the list),
 *   children (the rows).
 * Responsive: it asks its own width, not the screen's: picture, text and state with buttons on one line from
 *   768 px of room; a stack below that (the picture and text, then the state, then the buttons). A long title is
 *   cut after two lines.
 * Accessibility: a list item; the title is a link only while Live; every button has a visible word followed by
 *   hidden text naming the listing, so rows with the same word are told apart; a button that is working keeps its
 *   label and place; the state is a word, never colour alone; the note is plain text with an icon.
 * States: Live, Pending review, Not approved (with its reason), Sold, Rented out; sale and rent; with and without
 *   picture, price or place; a button working. Dependencies: CardCover, QueueActionButtons, Badge, Icon, Link,
 *   cn. Tests: my-listing-row.test.tsx; Design Lab "Discovery" (S6-T03).
 * UX reference: dashboard screen, listings (lrow, side, btns, mini-note).
 */
import { CircleAlert, Clock, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { QueueActionButtons, type QueueAction } from "./listing-queue";
import { CardCover } from "./property-card-controls.client";

type MyListingNote = { tone: "waiting" | "rejected"; text: ReactNode };

type MyListingRowProps = {
  title: string;
  href?: string | null;
  cover?: { src: string; alt: string } | null;
  price: string;
  place?: string | null;
  posted: string;
  kind?: string | null;
  status: ReactNode;
  note?: MyListingNote | null;
  actions: QueueAction[];
  className?: string;
};

function MyListingRow({
  title,
  href,
  cover,
  price,
  place,
  posted,
  kind,
  status,
  note,
  actions,
  className,
}: MyListingRowProps) {
  return (
    <li
      data-slot="my-listing-row"
      className={cn("@container rounded-lg border border-line bg-surface p-4", className)}
    >
      <div className="flex flex-col gap-3 @3xl:flex-row @3xl:items-center @3xl:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-canvas-sunken">
            <CardCover src={cover?.src} alt={cover?.alt ?? ""} sizes="80px" />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="line-clamp-2 font-bold text-ink [overflow-wrap:anywhere]">
              {href ? <Link href={href}>{title}</Link> : title}
            </p>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-small text-muted">
              <b className="font-bold text-ink tabular-nums">{price}</b>
              {place ? <span>{place}</span> : null}
              <span>{posted}</span>
            </p>
            {kind ? (
              <span className="mt-1">
                <Badge tone="outline">{kind}</Badge>
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-3 @3xl:items-end">
          <div className="flex items-center gap-2">{status}</div>
          {actions.length > 0 ? (
            <QueueActionButtons actions={actions} className="@3xl:justify-end" />
          ) : null}
        </div>
      </div>
      {note ? (
        <p
          className={cn(
            "mt-3 flex items-start gap-2 text-small",
            note.tone === "rejected" ? "text-danger" : "text-muted",
          )}
        >
          <Icon icon={note.tone === "rejected" ? CircleAlert : Clock} size="sm" className="mt-1" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{note.text}</span>
        </p>
      ) : null}
    </li>
  );
}

type MyListingsListProps = {
  label: string;
  footnote?: ReactNode;
  children: ReactNode;
  className?: string;
};

function MyListingsList({ label, footnote, children, className }: MyListingsListProps) {
  return (
    <section data-slot="my-listings-list" className={cn("flex flex-col gap-3", className)}>
      <ul aria-label={label} className="flex flex-col gap-3">
        {children}
      </ul>
      {footnote ? (
        <p className="flex items-start gap-2 text-small text-muted">
          <Icon icon={Info} size="sm" className="mt-1" />
          <span>{footnote}</span>
        </p>
      ) : null}
    </section>
  );
}

export { MyListingRow, MyListingsList };
export type { MyListingNote, MyListingRowProps, MyListingsListProps };
