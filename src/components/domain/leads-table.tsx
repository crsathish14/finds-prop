/**
 * LeadsTable: the people who enquired about projects, with the one thing that can be changed: the lead's state.
 * Purpose: the rows of "Leads" for the admin and for a builder (S7-T01, FR-ADM-06, FR-BLD-04, BR-46, BR-47): when,
 *   which project, what they asked for, who they are, how to reach them, what they wrote, and whether they have been
 *   contacted. Owner: design system. It holds no state: the page passes the rows, already translated, and what
 *   happens when a state is chosen. The contact details cannot be edited anywhere here; the same table serves both
 *   roles. The tabs, the date and form filters, and the form submissions of the admin come with S7-T07.
 * Props: caption (names the table), columns ({ date, project, type, name, phone ({ text, href }), email, message, status }, the
 *   heading words), rows ({ id, date, project, type (a Badge: Enquiry, Site visit or Brochure), name, phone, email,
 *   message (email and message are text already formatted: a dash when none was given), status { value, label (names the box, "Status for Arjun Menon"), options: { value, label }[], onChange,
 *   disabled } }), countText ("4 leads"), note (a second line under the list, for a builder: "You can change a lead's
 *   status. Contact details can't be edited."), className. An empty list is the page's EmptyState.
 * Responsive: the list asks its own width: a table from 1024 px of room, cards below that (the date, then each value
 *   under its word, the state last as a box). The phone number is a call link; a long message is cut after two lines
 *   in the table and shown whole on a card.
 * Accessibility: a real table with its roles kept in the card layout; the phone number is a link ("tel:") that says
 *   what it is; each state box has its own name that includes the person; the state is also a word in the box.
 * States: any number of rows; new, contacted, closed; no email or no message (a dash); a long name, email and
 *   message; a state box that is saving (off).
 * Dependencies: ResponsiveTable, NativeSelect, cn. Tests: leads-table.test.tsx; Design Lab "Admin" (S7-T01).
 * UX reference: admin-leads and builder-leads screens (fp-leadspage, project leads).
 */
import type { ReactNode } from "react";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
  type ResponsiveTableRow,
} from "@/components/patterns/responsive-table";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/cn";

type LeadRow = {
  id: string;
  date: string;
  project: string;
  type: ReactNode;
  name: string;
  /** The number as shown and as a call link, such as { text: "98410 55512", href: "tel:9841055512" }. */
  phone: { text: string; href: string };
  /** Text already formatted: a dash when the person gave none. */
  email: string;
  message: string;
  status: {
    value: string;
    label: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
    disabled?: boolean;
  };
};

type LeadsTableProps = {
  caption: string;
  columns: {
    date: string;
    project: string;
    type: string;
    name: string;
    phone: string;
    email: string;
    message: string;
    status: string;
  };
  rows: LeadRow[];
  countText: string;
  note?: string;
  className?: string;
};

function LeadsTable({ caption, columns, rows, countText, note, className }: LeadsTableProps) {
  const tableColumns: ResponsiveTableColumn[] = [
    { id: "date", heading: columns.date, role: "main", width: 11 },
    { id: "project", heading: columns.project, width: 12 },
    { id: "type", heading: columns.type, width: 9 },
    { id: "name", heading: columns.name, width: 12 },
    { id: "phone", heading: columns.phone, width: 11, nowrap: true },
    { id: "email", heading: columns.email, width: 15 },
    { id: "message", heading: columns.message, width: 16 },
    { id: "status", heading: columns.status, width: 14 },
  ];
  const tableRows: ResponsiveTableRow[] = rows.map((row) => ({
    id: row.id,
    cells: {
      date: <b className="text-ink">{row.date}</b>,
      project: <span className="text-ink [overflow-wrap:anywhere]">{row.project}</span>,
      type: row.type,
      name: <span className="text-ink [overflow-wrap:anywhere]">{row.name}</span>,
      phone: (
        <a
          href={row.phone.href}
          className="rounded-xs font-semibold text-primary underline decoration-line-strong underline-offset-4 hover:decoration-primary"
        >
          {row.phone.text}
        </a>
      ),
      email: <span className="[overflow-wrap:anywhere]">{row.email}</span>,
      message: (
        <span className="line-clamp-none text-small text-ink [overflow-wrap:anywhere] @5xl:line-clamp-2">
          {row.message}
        </span>
      ),
      status: (
        <NativeSelect
          aria-label={row.status.label}
          value={row.status.value}
          disabled={row.status.disabled ?? false}
          onChange={(event) => row.status.onChange(event.target.value)}
          className="min-h-11 text-small"
        >
          {row.status.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
      ),
    },
  }));
  return (
    <div data-slot="leads-table" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <ResponsiveTable caption={caption} columns={tableColumns} rows={tableRows} />
      <p className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
        <span>{countText}</span>
        {note ? <span>{note}</span> : null}
      </p>
    </div>
  );
}

export { LeadsTable };
export type { LeadRow, LeadsTableProps };
