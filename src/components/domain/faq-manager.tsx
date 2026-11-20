/**
 * FaqManager: the admin's list of FAQ questions.
 * Purpose: the whole of the "FAQ" admin page above its data (ADR-143, FR-ADM-13): the heading with Add question and
 *   Categories, the tabs All, Published, Drafts and Trash, a category filter, a search of the questions and answers, a
 *   table that becomes cards on a phone, and on each row Edit, Publish or Unpublish (Restore in the Trash), Move to
 *   Trash and, when one category is chosen, Move up and Move down. Owner: design system. It holds no state: the page
 *   passes the rows, already translated, what each button does, and what is chosen. The edit form is its own page
 *   (FaqFormFields); the category manager is a drawer (CategoryManager) that the page opens from Categories.
 * Props: title, intro, addLabel and addHref, categoriesLabel and onCategories, tabs ({ label (names the group),
 *   options: { value, label, count }[], value, onChange }), category ({ label, allLabel, options: { value, label }[],
 *   value, onChange }), search ({ value, onChange, label, placeholder }), columns ({ question, category, status,
 *   updated, actions }, the heading words), caption, rows (see FaqRow), countText ("6 of 38 questions"), note (a
 *   second line under the list, such as "Drag order applies to one category: choose a category to change it"),
 *   empty ({ title, text } for no questions, noMatches ({ title, text }) for a filter that finds none), pending (the
 *   list is being changed: every row button is off), headingLevel ("h1" default | "h2"), className. A row is { id,
 *   question, categoryName, status ("published" | "draft"), statusLabel, updated, trashed, editHref, editLabel,
 *   editFor, toggle ({ label, forName, onClick }: Publish, Unpublish or Restore), trash ({ label (the whole name of
 *   the button), onClick }, left out in the Trash), moveUp and moveDown ({ label (the whole name), onClick,
 *   disabled }, left out unless one category is chosen) }.
 * Responsive: the list asks its own width: a table from 1024 px of room, cards below that (the question, then
 *   Category, Status and Updated with their words, then the buttons). The tabs and the filters stack on a phone; the
 *   tabs scroll sideways rather than wrap.
 * Accessibility: the tabs are toggle buttons in a labelled group; a real table with its roles kept in the card
 *   layout; each visible word of a button is followed by hidden text naming the question; the icon buttons carry
 *   their whole name; the status is a word beside its dot, never colour alone; a trashed question says Trash in
 *   its status.
 * States: any number of rows; published, draft, in the Trash; a very long question and a long category name;
 *   one category chosen (the order buttons show, the first Move up and the last Move down are off); a list being
 *   changed; nothing yet; no match for the filters.
 * Dependencies: ResponsiveTable, Chip, FormField, Select, Input, EmptyState, Badge, Button, IconButton, Link.
 *   Tests: faq-parts.test.tsx; Design Lab "Site content" (ADR-143).
 * UX reference: none approved yet; drawn in the Design Lab for the owner to approve (ADR-143). It follows the admin
 *   units list (admin-units screen).
 */
import { ArrowDown, ArrowUp, Plus, RotateCcw, Search, Tags, Trash2 } from "lucide-react";
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

type FaqRowButton = { label: string; onClick: () => void };

type FaqRow = {
  id: string;
  question: string;
  categoryName: string;
  status: "published" | "draft";
  /** "Published", "Draft" or "In the Trash": the word beside the dot. */
  statusLabel: string;
  /** Already formatted, such as "20 Nov 2026". */
  updated: string;
  trashed?: boolean;
  editHref: string;
  editLabel: string;
  /** What Edit acts on, heard after its visible word, such as "question: How do I list my property?". */
  editFor: string;
  /** Publish, Unpublish or (in the Trash) Restore. `forName` is heard after the visible word. */
  toggle: FaqRowButton & { forName: string };
  /** Move to Trash: the whole name of the button. Left out for a question already in the Trash. */
  trash?: FaqRowButton;
  moveUp?: FaqRowButton & { disabled?: boolean };
  moveDown?: FaqRowButton & { disabled?: boolean };
};

type FaqManagerProps = {
  title: string;
  intro: string;
  addLabel: string;
  addHref: string;
  categoriesLabel: string;
  onCategories: () => void;
  headingLevel?: "h1" | "h2";
  tabs: {
    label: string;
    options: { value: string; label: string; count: number }[];
    value: string;
    onChange: (value: string) => void;
  };
  category: {
    label: string;
    allLabel: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
  };
  search: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    placeholder: string;
  };
  columns: { question: string; category: string; status: string; updated: string; actions: string };
  caption: string;
  rows: FaqRow[];
  countText: string;
  note?: string;
  empty: { title: string; text: string };
  noMatches: { title: string; text: string };
  /** The list holds a question that was never saved or is being changed: every row button is off. */
  pending?: boolean;
  className?: string;
};

function FaqManager({
  title,
  intro,
  addLabel,
  addHref,
  categoriesLabel,
  onCategories,
  headingLevel = "h1",
  tabs,
  category,
  search,
  columns,
  caption,
  rows,
  countText,
  note,
  empty,
  noMatches,
  pending = false,
  className,
}: FaqManagerProps) {
  const filtering = search.value.trim() !== "" || category.value !== "";
  const tableColumns: ResponsiveTableColumn[] = [
    { id: "question", heading: columns.question, role: "main", width: 34 },
    { id: "category", heading: columns.category, width: 16 },
    { id: "status", heading: columns.status, width: 14 },
    { id: "updated", heading: columns.updated, width: 12, nowrap: true },
    { id: "actions", heading: columns.actions, role: "actions", width: 24 },
  ];
  const tableRows: ResponsiveTableRow[] = rows.map((row) => ({
    id: row.id,
    cells: {
      question: <b className="text-ink [overflow-wrap:anywhere]">{row.question}</b>,
      category: <span className="[overflow-wrap:anywhere]">{row.categoryName}</span>,
      status: (
        <Badge
          dot
          tone={row.trashed ? "danger" : row.status === "published" ? "success" : "neutral"}
        >
          {row.statusLabel}
        </Badge>
      ),
      updated: row.updated,
      actions: (
        <>
          {row.moveUp ? (
            <IconButton
              aria-label={row.moveUp.label}
              disabled={pending || (row.moveUp.disabled ?? false)}
              onClick={row.moveUp.onClick}
            >
              <Icon icon={ArrowUp} />
            </IconButton>
          ) : null}
          {row.moveDown ? (
            <IconButton
              aria-label={row.moveDown.label}
              disabled={pending || (row.moveDown.disabled ?? false)}
              onClick={row.moveDown.onClick}
            >
              <Icon icon={ArrowDown} />
            </IconButton>
          ) : null}
          {row.trashed ? null : (
            <Button asChild variant="ghost" size="sm">
              <Link href={row.editHref} variant="nav" className="no-underline">
                {row.editLabel} <VisuallyHidden>{row.editFor}</VisuallyHidden>
              </Link>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={row.toggle.onClick}
            iconStart={row.trashed ? <Icon icon={RotateCcw} size="sm" /> : undefined}
          >
            {row.toggle.label} <VisuallyHidden>{row.toggle.forName}</VisuallyHidden>
          </Button>
          {row.trash ? (
            <IconButton
              aria-label={row.trash.label}
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
    <div data-slot="faq-manager" className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Heading as={headingLevel} size="1">
            {title}
          </Heading>
          <Text tone="muted">{intro}</Text>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            iconStart={<Icon icon={Tags} size="sm" />}
            onClick={onCategories}
          >
            {categoriesLabel}
          </Button>
          <Button asChild variant="primary">
            <Link href={addHref} variant="nav" className="no-underline">
              <Icon icon={Plus} size="sm" />
              {addLabel}
            </Link>
          </Button>
        </div>
      </div>
      <div
        role="group"
        aria-label={tabs.label}
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.options.map((option) => (
          <Chip
            key={option.value}
            size="sm"
            selected={tabs.value === option.value}
            onClick={() => tabs.onChange(option.value)}
          >
            {option.label} <span className="tabular-nums">{option.count}</span>
          </Chip>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="md:w-72">
          <FormField label={category.label}>
            <Select
              value={category.value}
              onChange={(event) => category.onChange(event.target.value)}
            >
              <option value="">{category.allLabel}</option>
              {category.options.map((option) => (
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
            aria-label={search.label}
            placeholder={search.placeholder}
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            leading={<Icon icon={Search} />}
          />
        </div>
      </div>
      {rows.length === 0 ? (
        filtering ? (
          <EmptyState title={noMatches.title} description={noMatches.text} />
        ) : (
          <EmptyState title={empty.title} description={empty.text}>
            <Button asChild variant="primary">
              <Link href={addHref} variant="nav" className="no-underline">
                <Icon icon={Plus} size="sm" />
                {addLabel}
              </Link>
            </Button>
          </EmptyState>
        )
      ) : (
        <>
          <ResponsiveTable caption={caption} columns={tableColumns} rows={tableRows} />
          <p className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
            <span>{countText}</span>
            {note ? <span>{note}</span> : null}
          </p>
        </>
      )}
    </div>
  );
}

export { FaqManager };
export type { FaqManagerProps, FaqRow, FaqRowButton };
