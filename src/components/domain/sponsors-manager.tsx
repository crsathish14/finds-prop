/**
 * SponsorsManager: the "Sponsors" section of the admin's Hero page: the heading with Add sponsor, the list of sponsors
 * in the order visitors will see them, and the line under it.
 * Purpose: where the admin sees every sponsor at a glance, puts them in order, edits one, deletes one or adds one
 *   (S7-T11, FR-ADM-11). Owner: design system. It holds no state: the page passes the rows, already translated, and
 *   what each button does. The drawer that adds or edits a sponsor (ManagerDrawer with SponsorFields) and the
 *   question before deleting (ConfirmDialog) belong to the page.
 * Props: title, intro, addLabel and onAdd, columns ({ advertiser, status, strip, panel, order, actions }, the heading
 *   words), caption (names the table), rows (see SponsorRow), countText ("3 sponsors · 2 active"), note (the line
 *   after it), words ({ ready, missing (the word for a format that is ready or not), statuses: { active, inactive,
 *   needsImages }, unnamed (the name shown for a sponsor saved without one) }), empty ({ title, text }), onMove
 *   (the row's id and "up" or "down"), headingLevel ("h2" default | "h1" | "h3"), className. A row is { id,
 *   advertiser, status ("active" | "inactive" | "needs_images"), strip and panel (true when that format has both its
 *   pictures), moveUpLabel and moveDownLabel (the whole names of the arrows, "Move Sample Developer up"), editLabel
 *   ("Edit"), editFor (the sponsor, heard after it), onEdit, deleteLabel (the whole name, "Delete Sample
 *   Developer"), onDelete, pending }.
 * Responsive: the list asks its own width: a table from 1024 px of room, a card for each sponsor below that (the
 *   name, then Status, Strip, Panel and Order with their words, then Edit and Delete).
 * Accessibility: a real table with its roles kept in the card layout; every state is a word with an icon or a dot,
 *   never colour alone; the first sponsor's Up and the last one's Down are off; each arrow, Edit and Delete says which
 *   sponsor it is for; the empty list is a titled message with its own Add button.
 * States: any number of rows; active, inactive, needs images; a format ready or missing; one sponsor only (both
 *   arrows off); a very long name; a sponsor with no name; nothing yet; a row that is being saved (its buttons are off).
 * Dependencies: ResponsiveTable, Badge, EmptyState, Button, IconButton, Heading, Text. Tests:
 *   sponsors-manager.test.tsx; Design Lab "Sponsor list" (S7-T11).
 * UX reference: admin-sponsors screen (the Sponsors panel: .sp-table, .adv, .fmt-ok, .fmt-no, empty-note). The
 *   "Booking" line under each name is left out (ADR-105), and a Delete button is added to each row because the screen
 *   shows the question but not what opens it (ADR-109).
 */
import { ArrowDown, ArrowUp, CircleCheck, CircleX, Pencil, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { EmptyState } from "@/components/patterns/empty-state";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
  type ResponsiveTableRow,
} from "@/components/patterns/responsive-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type SponsorStatus = "active" | "inactive" | "needs_images";

type SponsorRow = {
  id: string;
  advertiser: string;
  status: SponsorStatus;
  /** A format is ready when both its pictures, desktop and phone, are there. */
  strip: boolean;
  panel: boolean;
  moveUpLabel: string;
  moveDownLabel: string;
  editLabel: string;
  /** What Edit acts on, heard after its visible word, such as "Sample Developer". */
  editFor: string;
  onEdit: () => void;
  deleteLabel: string;
  onDelete: () => void;
  /** The sponsor is being saved or deleted: every button of the row is off. */
  pending?: boolean;
};

type SponsorsManagerWords = {
  ready: string;
  missing: string;
  statuses: { active: string; inactive: string; needsImages: string };
  unnamed: string;
};

type SponsorsManagerProps = {
  title: string;
  intro: string;
  addLabel: string;
  onAdd: () => void;
  /** Adding is off, such as when the list is full or while saving. */
  addDisabled?: boolean;
  columns: {
    advertiser: string;
    status: string;
    strip: string;
    panel: string;
    order: string;
    actions: string;
  };
  caption: string;
  rows: SponsorRow[];
  countText: string;
  note?: string;
  words: SponsorsManagerWords;
  empty: { title: string; text: string };
  onMove: (id: string, direction: "up" | "down") => void;
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
};

/** Up to two capital letters from the name: "Sample Developer" becomes "SD". */
function monogram(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((part) => part !== "")
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

function Format({ ready, words }: { ready: boolean; words: SponsorsManagerWords }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-small font-semibold",
        ready ? "text-success" : "text-muted",
      )}
    >
      <Icon icon={ready ? CircleCheck : CircleX} size="sm" />
      {ready ? words.ready : words.missing}
    </span>
  );
}

function StatusLabel({ status, words }: { status: SponsorStatus; words: SponsorsManagerWords }) {
  if (status === "active") {
    return (
      <Badge dot tone="success">
        {words.statuses.active}
      </Badge>
    );
  }
  if (status === "needs_images") {
    return (
      <Badge dot tone="warning">
        {words.statuses.needsImages}
      </Badge>
    );
  }
  return (
    <Badge dot tone="neutral">
      {words.statuses.inactive}
    </Badge>
  );
}

function SponsorsManager({
  title,
  intro,
  addLabel,
  onAdd,
  addDisabled = false,
  columns,
  caption,
  rows,
  countText,
  note,
  words,
  empty,
  onMove,
  headingLevel = "h2",
  className,
}: SponsorsManagerProps) {
  const headingId = useId();
  const add = (
    <Button
      type="button"
      variant="primary"
      size="sm"
      disabled={addDisabled}
      iconStart={<Icon icon={Plus} size="sm" />}
      onClick={onAdd}
    >
      {addLabel}
    </Button>
  );

  const tableColumns: ResponsiveTableColumn[] = [
    { id: "advertiser", heading: columns.advertiser, role: "main", width: 30 },
    { id: "status", heading: columns.status, width: 16 },
    { id: "strip", heading: columns.strip, width: 14 },
    { id: "panel", heading: columns.panel, width: 14 },
    { id: "order", heading: columns.order, width: 10 },
    { id: "actions", heading: columns.actions, role: "actions", width: 16 },
  ];
  const tableRows: ResponsiveTableRow[] = rows.map((row, index) => {
    const off = row.pending ?? false;
    const name = row.advertiser.trim();
    return {
      id: row.id,
      cells: {
        advertiser: (
          <span className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-tint text-small font-bold text-primary"
            >
              {monogram(name)}
            </span>
            <b className={cn("min-w-0 [overflow-wrap:anywhere]", name ? "text-ink" : "text-muted")}>
              {name || words.unnamed}
            </b>
          </span>
        ),
        status: <StatusLabel status={row.status} words={words} />,
        strip: <Format ready={row.strip} words={words} />,
        panel: <Format ready={row.panel} words={words} />,
        order: (
          <span className="flex items-center gap-1">
            <IconButton
              aria-label={row.moveUpLabel}
              disabled={off || index === 0}
              onClick={() => onMove(row.id, "up")}
            >
              <Icon icon={ArrowUp} />
            </IconButton>
            <IconButton
              aria-label={row.moveDownLabel}
              disabled={off || index === rows.length - 1}
              onClick={() => onMove(row.id, "down")}
            >
              <Icon icon={ArrowDown} />
            </IconButton>
          </span>
        ),
        actions: (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={off}
              onClick={row.onEdit}
              iconStart={<Icon icon={Pencil} size="sm" />}
            >
              {row.editLabel} <VisuallyHidden>{row.editFor}</VisuallyHidden>
            </Button>
            <IconButton
              aria-label={row.deleteLabel}
              disabled={off}
              onClick={row.onDelete}
              className="text-danger"
            >
              <Icon icon={Trash2} />
            </IconButton>
          </>
        ),
      },
    };
  });

  return (
    <section
      data-slot="sponsors-manager"
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-4 md:p-6",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Heading as={headingLevel} size="3" id={headingId}>
            {title}
          </Heading>
          <Text tone="muted" className="text-small">
            {intro}
          </Text>
        </div>
        {add}
      </div>
      {rows.length === 0 ? (
        <EmptyState as="h3" title={empty.title} description={empty.text}>
          {add}
        </EmptyState>
      ) : (
        <>
          <ResponsiveTable caption={caption} columns={tableColumns} rows={tableRows} />
          <p className="flex flex-wrap items-center justify-between gap-2 text-small text-muted">
            <span>{countText}</span>
            {note ? <span>{note}</span> : null}
          </p>
        </>
      )}
    </section>
  );
}

export { SponsorsManager };
export type { SponsorRow, SponsorStatus, SponsorsManagerProps, SponsorsManagerWords };
