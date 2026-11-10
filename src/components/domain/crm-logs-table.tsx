/**
 * CrmLogsTable: what was sent to the CRMs, and how each call went.
 * Purpose: the "API logs" tab of the admin's CRM page (S7-T09, FR-ADM-09): one line for each call, newest first, with
 *   the time, the CRM, the form, whether it worked, the CRM's HTTP status, the number of the attempt, the start of the
 *   answer, and a Retry button on a failed delivery that can still be sent again. Owner: design system. It holds no
 *   state: the page passes the rows, already translated and formatted, and what Retry does.
 * Props: caption (names the table), columns ({ time, crm, form, status, http, attempt, response, actions }, the heading
 *   words), rows ({ id, time, crm, form, status (a Badge or StatusBadge), http (the number, or a dash when there was no
 *   answer), attempt, response (the start of the answer, cut already; a dash when there is none), retry ({ label, forName,
 *   onClick, pending }) or none }), countText ("3 deliveries"), note (the retry schedule sentence), empty ({ title,
 *   text }), className.
 * Responsive: the list asks its own width: a table from 1024 px of room, cards below that (the time, then each value
 *   under its word, then Retry). The answer is code text that breaks anywhere.
 * Accessibility: a real table with its roles kept in the card layout; the state is a word; the Retry button's visible
 *   word is followed by hidden text naming the CRM and the time, because several rows have one.
 * States: any number of rows; success, failed, retrying; no answer (a dash for the status); a long answer; a row
 *   that cannot be retried (no button); a retry running (the button is working); nothing yet (the empty state).
 * Dependencies: ResponsiveTable, EmptyState, Button, Icon, VisuallyHidden, cn. Tests: crm-parts.test.tsx; Design Lab
 *   "CRM" (S7-T09).
 * UX reference: admin-crm screen, the API logs tab (tbl, tbl--stack, tbl-foot).
 */
import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/patterns/empty-state";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
  type ResponsiveTableRow,
} from "@/components/patterns/responsive-table";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type CrmLogRow = {
  id: string;
  time: string;
  crm: string;
  form: string;
  status: ReactNode;
  http: string;
  attempt: string;
  response: string;
  retry?: { label: string; forName: string; onClick: () => void; pending?: boolean } | undefined;
};

type CrmLogsTableProps = {
  caption: string;
  columns: {
    time: string;
    crm: string;
    form: string;
    status: string;
    http: string;
    attempt: string;
    response: string;
    actions: string;
  };
  rows: CrmLogRow[];
  countText: string;
  note?: string;
  empty: { title: string; text: string };
  className?: string;
};

function CrmLogsTable({
  caption,
  columns,
  rows,
  countText,
  note,
  empty,
  className,
}: CrmLogsTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title={empty.title}
        description={empty.text}
        {...(className ? { className } : {})}
      />
    );
  }
  const tableColumns: ResponsiveTableColumn[] = [
    { id: "time", heading: columns.time, role: "main", width: 13, nowrap: true },
    { id: "crm", heading: columns.crm, width: 12 },
    { id: "form", heading: columns.form, width: 14 },
    { id: "status", heading: columns.status, width: 10 },
    { id: "http", heading: columns.http, align: "end", width: 6, nowrap: true },
    { id: "attempt", heading: columns.attempt, align: "end", width: 7, nowrap: true },
    { id: "response", heading: columns.response, width: 24 },
    { id: "actions", heading: columns.actions, role: "actions", width: 12 },
  ];
  const tableRows: ResponsiveTableRow[] = rows.map((row) => ({
    id: row.id,
    cells: {
      time: <b className="text-ink">{row.time}</b>,
      crm: <span className="text-ink [overflow-wrap:anywhere]">{row.crm}</span>,
      form: <span className="[overflow-wrap:anywhere]">{row.form}</span>,
      status: row.status,
      http: <span className="tabular-nums">{row.http}</span>,
      attempt: <span className="tabular-nums">{row.attempt}</span>,
      response: (
        <code className="font-mono text-caption text-muted [overflow-wrap:anywhere]">
          {row.response}
        </code>
      ),
      actions: row.retry ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={row.retry.pending ?? false}
          iconStart={<Icon icon={RefreshCw} size="sm" />}
          onClick={row.retry.onClick}
        >
          {row.retry.label} <VisuallyHidden>{row.retry.forName}</VisuallyHidden>
        </Button>
      ) : null,
    },
  }));
  return (
    <div data-slot="crm-logs-table" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <ResponsiveTable caption={caption} columns={tableColumns} rows={tableRows} />
      <p className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
        <span>{countText}</span>
        {note ? <span>{note}</span> : null}
      </p>
    </div>
  );
}

export { CrmLogsTable };
export type { CrmLogRow, CrmLogsTableProps };
