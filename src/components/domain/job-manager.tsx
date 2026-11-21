/**
 * JobManager: the admin's list of jobs.
 * Purpose: the whole of the "Careers" admin page above its data (ADR-143 section 5, FR-ADM-15): the heading with Add
 *   job and Departments, the tabs All, Open, Drafts, Closed and Trash, a department filter, a search of the jobs, a table
 *   that becomes cards on a phone, and on each row Edit, Open or Close posting or Reopen (Restore in the Trash) and
 *   Move to Trash. Owner: design system. It holds no state: the page passes the rows, what each button does and what
 *   is chosen. The edit form is its own page (JobFormFields); the department manager is a drawer (CategoryManager)
 *   the page opens from Departments.
 * Props: addHref, onDepartments, headingLevel ("h1" default | "h2"), tabs ({ options: { value ("all" | "open" |
 *   "draft" | "closed" | "trash"), count }[], value, onChange }), department ({ options: { value, label }[], value,
 *   onChange }), search ({ value, onChange }), caption (names the table), rows (see JobRow), countText ("6 of 38 jobs"),
 *   pending (a row is being changed: every row button is off), className. A row is { id, title, departmentName,
 *   location, status ("draft" | "open" | "closed"), trashed, expired (open, but its closing date has passed), updated
 *   (already formatted), closes (already formatted, or null), editHref, step ({ kind: "open" | "close" | "reopen" |
 *   "restore", onClick }), trash ({ onClick }, left out in the Trash) }.
 * Responsive: the list asks its own width: a table from 1024 px of room, cards below that. The tabs and the filters
 *   stack on a phone; the tabs scroll sideways rather than wrap.
 * Accessibility: the tabs are toggle buttons in a labelled group; a real table with its roles kept in the card layout;
 *   each visible word of a button is followed by hidden text naming the job; the icon button carries its whole name;
 *   the status is a word beside its dot, never colour alone; an expired job says Expired and a trashed one says In the
 *   Trash.
 * States: any number of rows; draft, open, expired, closed, in the Trash; a very long title and place; a list being
 *   changed; nothing yet; no match for the filters.
 * Dependencies: ResponsiveTable, Chip, FormField, Select, Input, EmptyState, Badge, Button, IconButton, Link, next-intl.
 *   Tests: job-parts.test.tsx; Design Lab "Careers" (ADR-143).
 * UX reference: none yet; drawn for the owner's approval. It follows the admin FAQ list.
 */
import { Plus, RotateCcw, Search, Tags, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/patterns/empty-state";
import { FormField } from "@/components/patterns/form-field";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
  type ResponsiveTableRow,
} from "@/components/patterns/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Select } from "@/components/ui/select";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type JobTab = "all" | "open" | "draft" | "closed" | "trash";
type JobStep = "open" | "close" | "reopen" | "restore";

type JobRow = {
  id: string;
  title: string;
  departmentName: string;
  location: string;
  status: "draft" | "open" | "closed";
  trashed?: boolean;
  expired?: boolean;
  /** Already formatted, such as "20 Nov 2026". */
  updated: string;
  /** The closing date, already formatted, or null for "no closing date". */
  closes: string | null;
  editHref: string;
  step: { kind: JobStep; onClick: () => void };
  trash?: { onClick: () => void };
};

type JobManagerProps = {
  addHref: string;
  onDepartments: () => void;
  headingLevel?: "h1" | "h2";
  tabs: {
    options: { value: JobTab; count: number }[];
    value: JobTab;
    onChange: (value: JobTab) => void;
  };
  department: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
  };
  search: { value: string; onChange: (value: string) => void };
  caption: string;
  rows: JobRow[];
  countText: string;
  pending?: boolean;
  className?: string;
};

function JobManager({
  addHref,
  onDepartments,
  headingLevel = "h1",
  tabs,
  department,
  search,
  caption,
  rows,
  countText,
  pending = false,
  className,
}: JobManagerProps) {
  const translate = useTranslations();
  // A tab other than the first (All) narrows the list too, so an empty Open tab is "no match", not "nothing yet".
  const filtering =
    search.value.trim() !== "" ||
    department.value !== "" ||
    tabs.value !== (tabs.options[0]?.value ?? tabs.value);

  const statusWord = (row: JobRow): string =>
    row.trashed
      ? translate("admin.careers.status.trash")
      : row.status === "open" && row.expired
        ? translate("admin.careers.status.expired")
        : translate(`admin.careers.status.${row.status}`);

  const columns: ResponsiveTableColumn[] = [
    { id: "title", heading: translate("admin.careers.columns.title"), role: "main", width: 30 },
    { id: "department", heading: translate("admin.careers.columns.department"), width: 14 },
    { id: "location", heading: translate("admin.careers.columns.location"), width: 12 },
    { id: "status", heading: translate("admin.careers.columns.status"), width: 12 },
    { id: "closes", heading: translate("admin.careers.columns.closes"), width: 10, nowrap: true },
    { id: "updated", heading: translate("admin.careers.columns.updated"), width: 10, nowrap: true },
    {
      id: "actions",
      heading: translate("admin.careers.columns.actions"),
      role: "actions",
      width: 22,
    },
  ];

  const tableRows: ResponsiveTableRow[] = rows.map((row) => ({
    id: row.id,
    cells: {
      title: <b className="text-ink [overflow-wrap:anywhere]">{row.title}</b>,
      department: <span className="[overflow-wrap:anywhere]">{row.departmentName}</span>,
      location: <span className="[overflow-wrap:anywhere]">{row.location}</span>,
      status: (
        <Badge
          dot
          tone={
            row.trashed
              ? "danger"
              : row.status === "open" && !row.expired
                ? "success"
                : row.expired
                  ? "warning"
                  : "neutral"
          }
        >
          {statusWord(row)}
        </Badge>
      ),
      closes: row.closes ?? translate("admin.careers.noClosing"),
      updated: row.updated,
      actions: (
        <>
          {row.trashed ? null : (
            <Button asChild variant="ghost" size="sm">
              <Link href={row.editHref} variant="nav" className="no-underline">
                {translate("admin.careers.edit")} <VisuallyHidden>{row.title}</VisuallyHidden>
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={row.step.onClick}
            iconStart={
              row.step.kind === "restore" ? <Icon icon={RotateCcw} size="sm" /> : undefined
            }
          >
            {translate(`admin.careers.step.${row.step.kind}`)}{" "}
            <VisuallyHidden>{row.title}</VisuallyHidden>
          </Button>
          {row.trash ? (
            <IconButton
              aria-label={translate("admin.careers.trashFor", { title: row.title })}
              disabled={pending}
              onClick={row.trash.onClick}
              className="text-danger"
            >
              <Icon icon={Trash2} />
            </IconButton>
          ) : null}
        </>
      ),
    },
  }));

  return (
    <div data-slot="job-manager" className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Heading as={headingLevel} size="1">
            {translate("admin.careers.title")}
          </Heading>
          <Text tone="muted">{translate("admin.careers.intro")}</Text>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            iconStart={<Icon icon={Tags} size="sm" />}
            onClick={onDepartments}
          >
            {translate("admin.careers.departments")}
          </Button>
          <Button asChild variant="primary">
            <Link href={addHref} variant="nav" className="no-underline">
              <Icon icon={Plus} size="sm" />
              {translate("admin.careers.add")}
            </Link>
          </Button>
        </div>
      </div>
      <div
        role="group"
        aria-label={translate("admin.careers.tabsLabel")}
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.options.map((option) => (
          <Chip
            key={option.value}
            size="sm"
            selected={tabs.value === option.value}
            onClick={() => tabs.onChange(option.value)}
          >
            {translate(`admin.careers.tabs.${option.value}`)}{" "}
            <span className="tabular-nums">{option.count}</span>
          </Chip>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="md:w-72">
          <FormField label={translate("admin.careers.departmentFilter")}>
            <Select
              value={department.value}
              onChange={(event) => department.onChange(event.target.value)}
            >
              <option value="">{translate("admin.careers.allDepartments")}</option>
              {department.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div className="md:grow">
          <Input
            type="search"
            aria-label={translate("admin.careers.searchLabel")}
            placeholder={translate("admin.careers.searchPlaceholder")}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            leading={<Icon icon={Search} />}
          />
        </div>
      </div>
      {rows.length === 0 ? (
        filtering ? (
          <EmptyState
            title={translate("admin.careers.noMatches.title")}
            description={translate("admin.careers.noMatches.text")}
          />
        ) : (
          <EmptyState
            title={translate("admin.careers.empty.title")}
            description={translate("admin.careers.empty.text")}
          >
            <Button asChild variant="primary">
              <Link href={addHref} variant="nav" className="no-underline">
                <Icon icon={Plus} size="sm" />
                {translate("admin.careers.add")}
              </Link>
            </Button>
          </EmptyState>
        )
      ) : (
        <>
          <ResponsiveTable caption={caption} columns={columns} rows={tableRows} />
          <p className="text-small text-muted">{countText}</p>
        </>
      )}
    </div>
  );
}

export { JobManager };
export type { JobManagerProps, JobRow, JobStep, JobTab };
