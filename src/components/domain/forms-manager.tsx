/**
 * FormsManager: the list of forms of the admin's Forms page.
 * Purpose: the first screen of the form builder (S7-T08, FR-ADM-08): the forms shown on project pages and the contact
 *   page, with the name and kind, the slug, how many fields, where the form is shown, which CRM it is linked to, an
 *   Active switch, and Edit, Duplicate and Delete. Owner: design system. It holds no state: the page passes the rows,
 *   already translated, and what each button does.
 * Props: title, headingLevel ("h1" default | "h2", for the Design Lab), intro, newLabel and newHref (the "New form" button, a link), caption (names the table for a screen
 *   reader), columns ({ name, slug, fields, placement, crm, active, actions }, the heading words), rows ({ id, name,
 *   kind (the words under the name, such as "Contact"), slug, fields (the count), placement, crm (the words,
 *   such as "Not linked"), active ({ checked, onChange, label (names the switch for the form), disabled }), edit
 *   ({ href, label, forName }), duplicate ({ label, forName, onClick, pending }), remove ({ label (names the form),
 *   onClick }) }), countText (the line under the list), empty ({ title, text }), notice (anything above the list),
 *   className.
 * Responsive: a table from 1024 px of room and cards below that (the shared ResponsiveTable); the Active switch is a
 *   48 px target on every screen; a long name wraps and a long slug breaks anywhere.
 * Accessibility: a real table; each switch and each button says which form it is for; the Delete button is an icon
 *   with the form's name in its label; a switch that is saving is off and says nothing different, so the page tells
 *   the result in a toast.
 * States: any number of forms; active and inactive; linked and not linked; a form being copied (the button is
 *   working) or switched (the switch is off); nothing yet (the empty page, with New form).
 * Dependencies: ResponsiveTable, EmptyState, Switch, Button, IconButton, Icon, Heading, Text, VisuallyHidden.
 *   Tests: form-parts.test.tsx; Design Lab "Forms" (S7-T08).
 * UX reference: admin-forms screen, the list (tbl, tbl--stack, switch, acts).
 */
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import NextLink from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/patterns/empty-state";
import {
  ResponsiveTable,
  type ResponsiveTableColumn,
} from "@/components/patterns/responsive-table";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { cn } from "@/lib/cn";

type FormRowView = {
  id: string;
  name: string;
  /** Under the name, such as "Enquiry". */
  kind: string;
  slug: string;
  fields: number;
  placement: string;
  crm: string;
  active: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    /** Names the switch for this form, such as "Active: Contact". */
    label: string;
    disabled?: boolean;
  };
  edit: { href: string; label: string; forName: string };
  duplicate: { label: string; forName: string; onClick: () => void; pending?: boolean };
  remove: { label: string; onClick: () => void };
};

type FormsManagerProps = {
  title: string;
  headingLevel?: "h1" | "h2";
  intro: string;
  newLabel: string;
  newHref: string;
  caption: string;
  columns: {
    name: string;
    slug: string;
    fields: string;
    placement: string;
    crm: string;
    active: string;
    actions: string;
  };
  rows: FormRowView[];
  countText: string;
  empty: { title: string; text: string };
  notice?: ReactNode;
  className?: string;
};

function FormsManager({
  title,
  headingLevel = "h1",
  intro,
  newLabel,
  newHref,
  caption,
  columns,
  rows,
  countText,
  empty,
  notice,
  className,
}: FormsManagerProps) {
  const tableColumns: ResponsiveTableColumn[] = [
    { id: "name", heading: columns.name, role: "main", width: 24 },
    { id: "slug", heading: columns.slug, width: 16 },
    { id: "fields", heading: columns.fields, align: "end", width: 8, nowrap: true },
    { id: "placement", heading: columns.placement, width: 16 },
    { id: "crm", heading: columns.crm, width: 12 },
    { id: "active", heading: columns.active, width: 8 },
    { id: "actions", heading: columns.actions, role: "actions", width: 16 },
  ];
  const tableRows = rows.map((row) => ({
    id: row.id,
    cells: {
      name: (
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-bold text-ink [overflow-wrap:anywhere]">{row.name}</p>
          <p className="text-small text-muted">{row.kind}</p>
        </div>
      ),
      slug: (
        <code className="font-mono text-small text-ink [overflow-wrap:anywhere]">{row.slug}</code>
      ),
      fields: <span className="font-bold text-ink tabular-nums">{row.fields}</span>,
      placement: <span className="text-ink">{row.placement}</span>,
      crm: <span className="text-ink">{row.crm}</span>,
      active: (
        <Switch
          aria-label={row.active.label}
          checked={row.active.checked}
          onCheckedChange={row.active.onChange}
          disabled={row.active.disabled ?? false}
        />
      ),
      actions: (
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <NextLink href={row.edit.href}>
              <Icon icon={Pencil} size="sm" />
              {row.edit.label} <VisuallyHidden>{row.edit.forName}</VisuallyHidden>
            </NextLink>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            loading={row.duplicate.pending ?? false}
            iconStart={<Icon icon={Copy} size="sm" />}
            onClick={row.duplicate.onClick}
          >
            {row.duplicate.label} <VisuallyHidden>{row.duplicate.forName}</VisuallyHidden>
          </Button>
          <IconButton
            aria-label={row.remove.label}
            className="text-danger"
            onClick={row.remove.onClick}
          >
            <Icon icon={Trash2} />
          </IconButton>
        </div>
      ),
    },
  }));

  return (
    <div data-slot="forms-manager" className={cn("flex min-w-0 flex-col gap-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Heading as={headingLevel} size="1">
            {title}
          </Heading>
          <Text tone="muted">{intro}</Text>
        </div>
        <Button asChild variant="primary">
          <NextLink href={newHref}>
            <Icon icon={Plus} size="sm" />
            {newLabel}
          </NextLink>
        </Button>
      </div>
      {notice}
      {rows.length === 0 ? (
        <EmptyState title={empty.title} description={empty.text}>
          <Button asChild variant="primary">
            <NextLink href={newHref}>
              <Icon icon={Plus} size="sm" />
              {newLabel}
            </NextLink>
          </Button>
        </EmptyState>
      ) : (
        <>
          <ResponsiveTable caption={caption} columns={tableColumns} rows={tableRows} />
          <p className="text-small text-muted">{countText}</p>
        </>
      )}
    </div>
  );
}

export { FormsManager };
export type { FormRowView, FormsManagerProps };
