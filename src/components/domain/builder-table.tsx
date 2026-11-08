/**
 * BuilderTable: the admin's list of builders and agents, as a table on wide areas and as cards on narrow ones.
 * Purpose: the rows of "Builders" in the admin portal (S7-T05, FR-ADM-04): who the company is and the email they
 *   sign in with, their state (Active, Invited, Inactive), how many projects and leads they have, when they last
 *   signed in, and what can be done to them. Owner: design system. It holds no state: the page passes the rows,
 *   already translated, and the buttons and menu of each row. A table component for all admin pages comes later
 *   (S7-T01); this one is specific to builders.
 * Props: caption (names the table for a screen reader), columns ({ company, status, projects, leads, lastSignIn,
 *   actions }, the heading words), rows ({ id, name, email, initials, type (a Badge such as "Agent", for an agent
 *   only), status (a StatusBadge), projects, leads, lastSignIn (the words, such as "Today, 09:40" or "Hasn't signed
 *   in yet"), actions (the row's buttons and menu) }), className.
 * Responsive: it asks its own width, not the screen's: a table from 1024 px of room, a stack of cards below that
 *   (each card: the company, then Status, Projects, Leads and Last sign-in with their words, then the actions). A
 *   long name wraps; a long email breaks anywhere.
 * Accessibility: a real table with its roles kept in the card layout, so it is still read as a table; the headings
 *   are hidden words on narrow areas and each value carries its word; the state is a word, never colour alone.
 * States: any number of rows; active, invited, inactive; a builder and an agent; a long name and email. An empty
 *   list is the page's EmptyState.
 * Dependencies: VisuallyHidden, cn. Tests: builder-parts.test.tsx; Design Lab "Admin" (S7-T05).
 * UX reference: admin-builders screen (tbl, tbl--stack, mono, cell).
 */
import type { ReactNode } from "react";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type BuilderTableRow = {
  id: string;
  name: string;
  email: string;
  /** Two letters in the round mark before the name. */
  initials: string;
  /** A badge beside the name for an agent; left out for a builder. */
  type?: ReactNode;
  status: ReactNode;
  projects: string;
  leads: string;
  lastSignIn: string;
  actions: ReactNode;
};

type BuilderTableColumns = {
  company: string;
  status: string;
  projects: string;
  leads: string;
  lastSignIn: string;
  actions: string;
};

type BuilderTableProps = {
  caption: string;
  columns: BuilderTableColumns;
  rows: BuilderTableRow[];
  className?: string;
};

/** The word above a value on a card; the table's heading says it from 1024 px. */
const valueLabel =
  "before:mb-1 before:block before:text-caption before:font-semibold before:text-muted before:content-[attr(data-label)] @5xl:before:hidden";

const cell = "@5xl:table-cell @5xl:px-3 @5xl:py-3 @5xl:align-middle";

function BuilderTable({ caption, columns, rows, className }: BuilderTableProps) {
  return (
    <div data-slot="builder-table" className={cn("@container min-w-0", className)}>
      <table
        role="table"
        className="block w-full border-collapse text-left @5xl:table @5xl:table-fixed @5xl:rounded-lg @5xl:border @5xl:border-line @5xl:bg-surface"
      >
        <caption className="sr-only">{caption}</caption>
        <colgroup className="hidden @5xl:table-column-group">
          <col className="@5xl:w-[32%]" />
          <col className="@5xl:w-[12%]" />
          <col className="@5xl:w-[9%]" />
          <col className="@5xl:w-[9%]" />
          <col className="@5xl:w-[16%]" />
          <col className="@5xl:w-[22%]" />
        </colgroup>
        <thead role="rowgroup" className="sr-only @5xl:not-sr-only @5xl:table-header-group">
          <tr role="row" className="@5xl:border-b @5xl:border-line">
            {(
              [
                ["company", columns.company],
                ["status", columns.status],
                ["projects", columns.projects],
                ["leads", columns.leads],
                ["lastSignIn", columns.lastSignIn],
                ["actions", columns.actions],
              ] as const
            ).map(([key, heading]) => (
              <th
                key={key}
                role="columnheader"
                scope="col"
                className={cn(
                  "px-3 py-3 text-caption font-semibold text-muted",
                  (key === "projects" || key === "leads" || key === "actions") && "text-right",
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
              <td role="cell" className={cn("min-w-0", cell)}>
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-md bg-primary-tint text-small font-bold text-primary"
                  >
                    {row.initials}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-ink [overflow-wrap:anywhere]">
                      <span>{row.name}</span>
                      {row.type}
                    </p>
                    <p className="text-small text-muted [overflow-wrap:anywhere]">{row.email}</p>
                  </div>
                </div>
              </td>
              <td role="cell" data-label={columns.status} className={cn(cell, valueLabel)}>
                <div className="flex flex-wrap items-center gap-2">{row.status}</div>
              </td>
              <td
                role="cell"
                data-label={columns.projects}
                className={cn("font-bold text-ink tabular-nums @5xl:text-right", cell, valueLabel)}
              >
                {row.projects}
              </td>
              <td
                role="cell"
                data-label={columns.leads}
                className={cn("font-bold text-ink tabular-nums @5xl:text-right", cell, valueLabel)}
              >
                {row.leads}
              </td>
              <td
                role="cell"
                data-label={columns.lastSignIn}
                className={cn("text-small text-ink", cell, valueLabel)}
              >
                {row.lastSignIn}
              </td>
              <td role="cell" className={cell}>
                <div className="flex flex-wrap items-center gap-2 @5xl:justify-end">
                  {row.actions}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { BuilderTable };
export type { BuilderTableColumns, BuilderTableProps, BuilderTableRow };
