/**
 * ListingQueue: the admin's list of listings to review, as a table on wide areas and as cards on narrow ones.
 * Purpose: the rows of "Listings" in the admin portal (S6-T04, FR-ADM-02): who posted what, at what price,
 *   when, in what state, and the decisions that can be made on it. Owner: design system. It holds no state:
 *   the page passes the rows, already translated, and what each button does. A table component for all admin
 *   pages comes later (S7-T01); this one is specific to listings.
 * Props: caption (names the table for a screen reader), columns ({ listing, owner, price, submitted,
 *   status, actions }, the heading words), rows ({ id, title, meta, cover { src, alt }, ownerName,
 *   ownerEmail, price, submitted, status (a StatusBadge, with a featured Badge beside it when featured), note
 *   (a line under the title, such as the reason a listing was rejected), actions }), className. An action is
 *   { id, label, forName, tone "primary" | "secondary" | "danger-outline", icon "check" | "cross" | "star",
 *   onClick, pending }. `forName` is the listing's title, heard after the visible word ("Approve" then
 *   "Independent villa"), because several buttons with the same word are on the page.
 * Responsive: it asks its own width, not the screen's: a table from 1024 px of room, a stack of cards below
 *   that (each card: picture and title, then Owner, Price, Submitted and Status with their words, then the
 *   buttons). Long titles are cut after two lines.
 * Accessibility: a real table with its roles kept in the card layout, so it is still read as a table; the
 *   headings are hidden words on narrow areas and each value carries its word; the buttons have a visible word
 *   followed by hidden text naming the listing; a button that is working keeps its label and its place.
 * States: any number of rows; pending, approved, featured, rejected (with its reason), sold; a row whose button
 *   is working; no owner email; no picture (a drawn tile). An empty list is the page's EmptyState.
 * Dependencies: Button, Icon, CardCover, VisuallyHidden, cn. Tests: listing-queue.test.tsx; Design Lab
 *   "Admin" (S6-T04).
 * UX reference: admin-listings screen (tbl, mod-actions, statusbar).
 */
import { Check, Star, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";
import { CardCover } from "./property-card-controls.client";

type QueueAction = {
  id: string;
  /** The visible word, such as "Approve". */
  label: string;
  /** What it acts on, heard after the visible word, such as the listing's title. */
  forName: string;
  tone: "primary" | "secondary" | "danger-outline";
  icon?: "check" | "cross" | "star";
  onClick: () => void;
  pending?: boolean;
};

type QueueRow = {
  id: string;
  title: string;
  /** Under the title, such as "OMR Sholinganallur · Villa · For sale". */
  meta: string;
  cover?: { src: string; alt: string } | null;
  ownerName: string;
  ownerEmail?: string | null;
  price: string;
  submitted: string;
  status: ReactNode;
  /** A line under the title: the reason of a rejection. */
  note?: ReactNode;
  actions: QueueAction[];
};

type QueueColumns = {
  listing: string;
  owner: string;
  price: string;
  submitted: string;
  status: string;
  actions: string;
};

type ListingQueueProps = {
  caption: string;
  columns: QueueColumns;
  rows: QueueRow[];
  className?: string;
};

const ICONS = { check: Check, cross: X, star: Star } as const;

/** The word above a value on a card; the table's heading says it from 1024 px. */
const valueLabel =
  "before:mb-1 before:block before:text-caption before:font-semibold before:text-muted before:content-[attr(data-label)] @5xl:before:hidden";

function QueueActionButtons({
  actions,
  className,
}: {
  actions: QueueAction[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2 @5xl:justify-end", className)}>
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          size="sm"
          variant={action.tone}
          loading={action.pending ?? false}
          onClick={action.onClick}
          {...(action.icon ? { iconStart: <Icon icon={ICONS[action.icon]} size="sm" /> } : {})}
        >
          {action.label} <VisuallyHidden>{action.forName}</VisuallyHidden>
        </Button>
      ))}
    </div>
  );
}

function ListingQueue({ caption, columns, rows, className }: ListingQueueProps) {
  return (
    <div data-slot="listing-queue" className={cn("@container min-w-0", className)}>
      <table
        role="table"
        className="block w-full border-collapse text-left @5xl:table @5xl:table-fixed @5xl:rounded-lg @5xl:border @5xl:border-line @5xl:bg-surface"
      >
        <caption className="sr-only">{caption}</caption>
        <colgroup className="hidden @5xl:table-column-group">
          <col className="@5xl:w-[24%]" />
          <col className="@5xl:w-[16%]" />
          <col className="@5xl:w-[12%]" />
          <col className="@5xl:w-[12%]" />
          <col className="@5xl:w-[13%]" />
          <col className="@5xl:w-[23%]" />
        </colgroup>
        <thead role="rowgroup" className="sr-only @5xl:not-sr-only @5xl:table-header-group">
          <tr role="row" className="@5xl:border-b @5xl:border-line">
            {(
              [
                ["listing", columns.listing],
                ["owner", columns.owner],
                ["price", columns.price],
                ["submitted", columns.submitted],
                ["status", columns.status],
                ["actions", columns.actions],
              ] as const
            ).map(([key, heading]) => (
              <th
                key={key}
                role="columnheader"
                scope="col"
                className={cn(
                  "px-3 py-3 text-caption font-semibold text-muted",
                  key === "price" && "text-right",
                  key === "actions" && "text-right",
                )}
              >
                {key === "actions" ? <VisuallyHidden>{heading}</VisuallyHidden> : heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup" className="flex flex-col gap-3 @5xl:table-row-group">
          {rows.map((row) => (
            <tr
              key={row.id}
              role="row"
              className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 @5xl:table-row @5xl:rounded-none @5xl:border-0 @5xl:border-t @5xl:border-line @5xl:p-0 @5xl:first:border-t-0"
            >
              <td
                role="cell"
                className="min-w-0 @5xl:table-cell @5xl:px-3 @5xl:py-3 @5xl:align-middle"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-md bg-canvas-sunken">
                    <CardCover src={row.cover?.src} alt={row.cover?.alt ?? ""} sizes="64px" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="line-clamp-2 font-bold text-ink [overflow-wrap:anywhere]">
                      {row.title}
                    </p>
                    <p className="text-small text-muted">{row.meta}</p>
                    {row.note ? <div className="mt-1 text-small text-ink">{row.note}</div> : null}
                  </div>
                </div>
              </td>
              <td
                role="cell"
                data-label={columns.owner}
                className={cn(
                  "min-w-0 @5xl:table-cell @5xl:px-3 @5xl:py-3 @5xl:align-middle",
                  valueLabel,
                )}
              >
                <span className="font-semibold text-ink [overflow-wrap:anywhere]">
                  {row.ownerName}
                </span>
                {row.ownerEmail ? (
                  <span className="block text-small text-muted [overflow-wrap:anywhere]">
                    {row.ownerEmail}
                  </span>
                ) : null}
              </td>
              <td
                role="cell"
                data-label={columns.price}
                className={cn(
                  "font-bold text-ink tabular-nums @5xl:table-cell @5xl:px-3 @5xl:py-3 @5xl:text-right @5xl:align-middle",
                  valueLabel,
                )}
              >
                {row.price}
              </td>
              <td
                role="cell"
                data-label={columns.submitted}
                className={cn(
                  "text-small text-ink @5xl:table-cell @5xl:px-3 @5xl:py-3 @5xl:align-middle",
                  valueLabel,
                )}
              >
                {row.submitted}
              </td>
              <td
                role="cell"
                data-label={columns.status}
                className={cn("@5xl:table-cell @5xl:px-3 @5xl:py-3 @5xl:align-middle", valueLabel)}
              >
                <div className="flex flex-wrap items-center gap-2">{row.status}</div>
              </td>
              <td role="cell" className="@5xl:table-cell @5xl:px-3 @5xl:py-3 @5xl:align-middle">
                <QueueActionButtons actions={row.actions} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ListingQueue, QueueActionButtons };
export type { ListingQueueProps, QueueAction, QueueColumns, QueueRow };
