/**
 * ResponsiveTable: one list of rows that is a table on wide areas and a stack of cards on narrow ones.
 * Purpose: the base of the lists in the admin and builder portals (S7-T01): projects, units and leads. One
 *   definition of the columns and rows draws both layouts, so a list never has two versions to keep in step.
 *   Owner: design system. It holds no state: the page passes the rows, already translated, with the buttons and
 *   menus of each row built.
 * Props: caption (names the table for a screen reader), columns ({ id, heading, role "main" | "actions" (leave
 *   out for an ordinary column), align "start" | "end", width (a percentage of the table, used from 1024 px of
 *   room), nowrap }), rows ({ id, cells: { [column id]: what to show } }), className. The "main" column is the
 *   first one: it names the row and has no word above it on a card. The "actions" column is the last one: its
 *   heading is hidden words, and its buttons sit at the foot of a card, to the right in the table.
 * Responsive: it asks its own width, not the screen's: a table from 1024 px of room, a stack of cards below that
 *   (each card: the main cell, then each other value under its word, then the actions).
 * Accessibility: a real table with its roles kept in the card layout, so it is still read as a table; the
 *   headings are hidden words on narrow areas and each value carries its word; a menu opened from a row is
 *   shown above the table, not clipped by it.
 * States: any number of rows; long words wrap (a long email breaks anywhere). An empty list is the page's
 *   EmptyState.
 * Dependencies: VisuallyHidden, cn. Tests: responsive-table.test.tsx; Design Lab "Admin" (S7-T01).
 * UX reference: admin-projects, admin-units and admin-leads screens (tbl, tbl--stack, cell).
 */
import type { ReactNode } from "react";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type ResponsiveTableColumn = {
  id: string;
  heading: string;
  role?: "main" | "actions";
  align?: "start" | "end";
  /** A percentage of the table from 1024 px of room; columns without one share what is left. */
  width?: number;
  /** Keep the value on one line (a date, a phone number). */
  nowrap?: boolean;
};

type ResponsiveTableRow = {
  id: string;
  cells: Record<string, ReactNode>;
};

type ResponsiveTableProps = {
  caption: string;
  columns: ResponsiveTableColumn[];
  rows: ResponsiveTableRow[];
  className?: string;
};

/** The word above a value on a card; the table's heading says it from 1024 px. */
const valueLabel =
  "before:mb-1 before:block before:text-caption before:font-semibold before:text-muted before:content-[attr(data-label)] @5xl:before:hidden";

const cell = "min-w-0 @5xl:table-cell @5xl:px-3 @5xl:py-3 @5xl:align-middle";

function ResponsiveTable({ caption, columns, rows, className }: ResponsiveTableProps) {
  return (
    <div data-slot="responsive-table" className={cn("@container min-w-0", className)}>
      <table
        role="table"
        className="block w-full border-collapse text-left @5xl:table @5xl:table-fixed @5xl:rounded-lg @5xl:border @5xl:border-line @5xl:bg-surface"
      >
        <caption className="sr-only">{caption}</caption>
        <colgroup className="hidden @5xl:table-column-group">
          {columns.map((column) => (
            <col
              key={column.id}
              {...(column.width === undefined ? {} : { style: { width: `${column.width}%` } })}
            />
          ))}
        </colgroup>
        <thead role="rowgroup" className="sr-only @5xl:not-sr-only @5xl:table-header-group">
          <tr role="row" className="@5xl:border-b @5xl:border-line">
            {columns.map((column) => (
              <th
                key={column.id}
                role="columnheader"
                scope="col"
                className={cn(
                  "px-3 py-3 text-caption font-semibold text-muted",
                  (column.align === "end" || column.role === "actions") && "text-right",
                )}
              >
                {column.role === "actions" ? (
                  <VisuallyHidden>{column.heading}</VisuallyHidden>
                ) : (
                  column.heading
                )}
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
              {columns.map((column) => {
                const content = row.cells[column.id];
                if (column.role === "main") {
                  return (
                    <td key={column.id} role="cell" className={cell}>
                      {content}
                    </td>
                  );
                }
                if (column.role === "actions") {
                  return (
                    <td key={column.id} role="cell" className={cell}>
                      <div className="flex flex-wrap items-center gap-2 @5xl:justify-end">
                        {content}
                      </div>
                    </td>
                  );
                }
                return (
                  <td
                    key={column.id}
                    role="cell"
                    data-label={column.heading}
                    className={cn(
                      cell,
                      valueLabel,
                      column.align === "end" && "@5xl:text-right",
                      column.nowrap && "whitespace-nowrap",
                    )}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ResponsiveTable };
export type { ResponsiveTableColumn, ResponsiveTableProps, ResponsiveTableRow };
