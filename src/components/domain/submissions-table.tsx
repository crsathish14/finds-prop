/**
 * SubmissionsTable: the forms people filled in, with how each stands with the CRM.
 * Purpose: the rows of the admin's "Form submissions" tab (S7-T07, FR-ADM-06): when, who, how to reach them, which
 *   project, where the form was, which form, whether the CRM got it, and a button for the whole submission. Owner:
 *   design system. It holds no state: the page passes the rows, already translated and formatted, and what the
 *   Details button does. The project leads have their own table (LeadsTable); the filters are SubmissionsFilters and
 *   the whole submission is SubmissionDetail.
 * Props: caption (names the table), columns ({ created, name, mobile, project, source, form, crm, actions }, the
 *   heading words), rows ({ id, created, name, mobile { text, href } or none, project, source, form, crm (a StatusBadge,
 *   with the CRM's own id beside it once delivered), openLabel ("Details"), openFor (who it is about, heard after
 *   the visible word), onOpen }), countText ("4 submissions"), note (a second line under the list, such as "Select
 *   Details to see the full submission."), className. A missing name, mobile, project or source is text already
 *   formatted: a dash. An empty list is the page's EmptyState.
 * Responsive: the list asks its own width: a table from 1024 px of room, cards below that (the time, then each
 *   value under its word, then Details). A long name or form wraps.
 * Accessibility: a real table with its roles kept in the card layout; the mobile number is a call link; the Details
 *   button's visible word is followed by hidden text naming the person, because every row has one; the CRM state is
 *   a word, never colour alone.
 * States: any number of rows; delivered, retrying, failed, not sent; no name, mobile, project or source (a dash); a
 *   long name and form.
 * Dependencies: ResponsiveTable, Button. Tests: submissions-parts.test.tsx; Design Lab "Admin" (S7-T07).
 * UX reference: admin-leads screen, "Form submissions" (fp-leadspage, subs).
 */
import { Eye } from "lucide-react";
import type { ReactNode } from "react";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
  type ResponsiveTableRow,
} from "@/components/patterns/responsive-table";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type SubmissionRow = {
  id: string;
  created: string;
  name: string;
  /** The number as shown and as a call link; none when the form did not ask for one. */
  mobile?: { text: string; href: string } | null;
  project: string;
  source: string;
  form: string;
  crm: ReactNode;
  openLabel: string;
  openFor: string;
  onOpen: () => void;
};

type SubmissionsTableProps = {
  caption: string;
  columns: {
    created: string;
    name: string;
    mobile: string;
    project: string;
    source: string;
    form: string;
    crm: string;
    actions: string;
  };
  rows: SubmissionRow[];
  countText: string;
  note?: string;
  /** What to show for a mobile number that was not given: a dash, already formatted. */
  noMobile: string;
  className?: string;
};

function SubmissionsTable({
  caption,
  columns,
  rows,
  countText,
  note,
  noMobile,
  className,
}: SubmissionsTableProps) {
  const tableColumns: ResponsiveTableColumn[] = [
    { id: "created", heading: columns.created, role: "main", width: 12 },
    { id: "name", heading: columns.name, width: 12 },
    { id: "mobile", heading: columns.mobile, width: 11, nowrap: true },
    { id: "project", heading: columns.project, width: 13 },
    { id: "source", heading: columns.source, width: 11 },
    { id: "form", heading: columns.form, width: 13 },
    { id: "crm", heading: columns.crm, width: 14 },
    { id: "actions", heading: columns.actions, role: "actions", width: 14 },
  ];
  const tableRows: ResponsiveTableRow[] = rows.map((row) => ({
    id: row.id,
    cells: {
      created: <b className="text-ink">{row.created}</b>,
      name: <span className="text-ink [overflow-wrap:anywhere]">{row.name}</span>,
      mobile: row.mobile ? (
        <a
          href={row.mobile.href}
          className="rounded-xs font-semibold text-primary underline decoration-line-strong underline-offset-4 hover:decoration-primary"
        >
          {row.mobile.text}
        </a>
      ) : (
        noMobile
      ),
      project: <span className="[overflow-wrap:anywhere]">{row.project}</span>,
      source: <span className="[overflow-wrap:anywhere]">{row.source}</span>,
      form: <span className="[overflow-wrap:anywhere]">{row.form}</span>,
      crm: <div className="flex flex-col items-start gap-1">{row.crm}</div>,
      actions: (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconStart={<Icon icon={Eye} size="sm" />}
          onClick={row.onOpen}
        >
          {row.openLabel} <VisuallyHidden>{row.openFor}</VisuallyHidden>
        </Button>
      ),
    },
  }));
  return (
    <div data-slot="submissions-table" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <ResponsiveTable caption={caption} columns={tableColumns} rows={tableRows} />
      <p className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
        <span>{countText}</span>
        {note ? <span>{note}</span> : null}
      </p>
    </div>
  );
}

export { SubmissionsTable };
export type { SubmissionRow, SubmissionsTableProps };
