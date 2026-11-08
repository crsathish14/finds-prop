/**
 * UnitsManager: the units of a project, for the admin and for a builder (the same screen for both).
 * Purpose: the whole of the "Units" page above its data (S7-T01, FR-ADM-05, FR-BLD-03): the heading and Add unit,
 *   the choice of project, a search for a unit number, the state chips, a table that becomes cards on a phone, an
 *   Edit and a Delete on each row, and the line under the list. Owner: design system. It holds no state: the page
 *   passes the rows, already translated, what each button does, and what is chosen. The drawer to add or edit a
 *   unit (ManagerDrawer with UnitForm) and the question before deleting (ConfirmDialog) belong to the page. The
 *   admin and the builder differ only in which projects the page offers, which the backend decides; so there
 *   is no `mode` here.
 * Props: title, intro, addLabel and onAdd, project ({ label, options, value, onChange }), search ({ value,
 *   onChange, label, placeholder }), states ({ label (names the group), options: { value, label }[], value,
 *   onChange }), columns ({ unit, floor, bhk, area, facing, price, status, actions }, the heading words), caption,
 *   rows (see UnitRow), countText ("6 of 320 units"), note (a second line under the list), empty ({ title, text }),
 *   headingLevel ("h1" default | "h2"), className. A row is { id, unitNumber, floor, bhk, area, facing, price,
 *   status (a StatusBadge), editLabel ("Edit"), editFor (the unit, heard after it), onEdit, deleteLabel (the whole
 *   name of the button, "Delete unit B-302"), onDelete, pending }.
 * Responsive: the list asks its own width: a table from 1024 px of room, cards below that (the unit number, then
 *   Floor, BHK, Area, Facing, Price and Status with their words, then Edit and Delete). The project, the search and
 *   the chips stack on a phone; the chips scroll sideways rather than wrap.
 * Accessibility: the chips are toggle buttons in a labelled group; a real table with its roles kept in the card
 *   layout; the Edit button's visible word is followed by hidden text naming the unit; Delete is an icon button with
 *   its own full name; the state is a word, never colour alone.
 * States: any number of rows; available, on hold, sold, blocked; a unit with no floor, area, facing or price (a dash);
 *   a long unit number; nothing yet; a row that is being deleted (its buttons are off).
 * Dependencies: ResponsiveTable, Chip, FormField, NativeSelect, Input, EmptyState, Button, IconButton.
 *   Tests: units-manager.test.tsx; Design Lab "Admin" (S7-T01).
 * UX reference: admin-units and builder-units screens (fp-unitspage).
 */
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/patterns/empty-state";
import { FormField } from "@/components/patterns/form-field";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
  type ResponsiveTableRow,
} from "@/components/patterns/responsive-table";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type UnitRow = {
  id: string;
  unitNumber: string;
  /** Floor, BHK, area, facing and price: text already formatted, or a dash when not given. */
  floor: string;
  bhk: string;
  area: string;
  facing: string;
  price: string;
  status: ReactNode;
  editLabel: string;
  /** What Edit acts on, heard after its visible word, such as "unit A-101". */
  editFor: string;
  onEdit: () => void;
  /** The whole name of the Delete button, such as "Delete unit A-101". */
  deleteLabel: string;
  onDelete: () => void;
  /** The unit is being deleted: both buttons are off. */
  pending?: boolean;
};

type UnitsManagerProps = {
  title: string;
  intro: string;
  addLabel: string;
  onAdd: () => void;
  headingLevel?: "h1" | "h2";
  project: {
    label: string;
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
  states: {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
  };
  columns: {
    unit: string;
    floor: string;
    bhk: string;
    area: string;
    facing: string;
    price: string;
    status: string;
    actions: string;
  };
  caption: string;
  rows: UnitRow[];
  countText: string;
  note?: string;
  empty: { title: string; text: string };
  className?: string;
};

function UnitsManager({
  title,
  intro,
  addLabel,
  onAdd,
  headingLevel = "h1",
  project,
  search,
  states,
  columns,
  caption,
  rows,
  countText,
  note,
  empty,
  className,
}: UnitsManagerProps) {
  const tableColumns: ResponsiveTableColumn[] = [
    { id: "unit", heading: columns.unit, role: "main", width: 14 },
    { id: "floor", heading: columns.floor, width: 8 },
    { id: "bhk", heading: columns.bhk, width: 8 },
    { id: "area", heading: columns.area, align: "end", width: 14, nowrap: true },
    { id: "facing", heading: columns.facing, width: 12 },
    { id: "price", heading: columns.price, align: "end", width: 14, nowrap: true },
    { id: "status", heading: columns.status, width: 14 },
    { id: "actions", heading: columns.actions, role: "actions", width: 16 },
  ];
  const tableRows: ResponsiveTableRow[] = rows.map((row) => ({
    id: row.id,
    cells: {
      unit: <b className="text-ink [overflow-wrap:anywhere]">{row.unitNumber}</b>,
      floor: row.floor,
      bhk: row.bhk,
      area: row.area,
      facing: row.facing,
      price: <span className="font-bold text-ink tabular-nums">{row.price}</span>,
      status: row.status,
      actions: (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={row.pending ?? false}
            onClick={row.onEdit}
            iconStart={<Icon icon={Pencil} size="sm" />}
          >
            {row.editLabel} <VisuallyHidden>{row.editFor}</VisuallyHidden>
          </Button>
          <IconButton
            aria-label={row.deleteLabel}
            disabled={row.pending ?? false}
            onClick={row.onDelete}
            className="text-danger"
          >
            <Icon icon={Trash2} />
          </IconButton>
        </>
      ),
    },
  }));

  return (
    <div data-slot="units-manager" className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Heading as={headingLevel} size="1">
            {title}
          </Heading>
          <Text tone="muted">{intro}</Text>
        </div>
        <Button
          type="button"
          variant="primary"
          iconStart={<Icon icon={Plus} size="sm" />}
          onClick={onAdd}
        >
          {addLabel}
        </Button>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="md:w-72">
          <FormField label={project.label}>
            <NativeSelect
              value={project.value}
              onChange={(event) => project.onChange(event.target.value)}
            >
              {project.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
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
      <div
        role="group"
        aria-label={states.label}
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {states.options.map((option) => (
          <Chip
            key={option.value}
            size="sm"
            selected={states.value === option.value}
            onClick={() => states.onChange(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title={empty.title} description={empty.text}>
          <Button
            type="button"
            variant="primary"
            iconStart={<Icon icon={Plus} size="sm" />}
            onClick={onAdd}
          >
            {addLabel}
          </Button>
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
    </div>
  );
}

export { UnitsManager };
export type { UnitRow, UnitsManagerProps };
