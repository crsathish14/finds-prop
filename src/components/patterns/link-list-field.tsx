"use client";

/**
 * LinkListField: a list of links (a label and where it goes) that the person adds, edits, reorders and removes.
 * Purpose: the header's navigation links and the footer's links in the admin's Site content pages (S7-T10,
 *   FR-ADM-10). Owner: design system. It holds no list of its own: the page keeps the rows, the errors and the words
 *   (already translated), and the order of the rows is the order the links show on the site.
 * Props: title (names the list), links ({ id, label, href }[]; an id is kept by the page and never shown), onChange
 *   (the new list), max (how many the list may hold), errors (the message of each box with a problem, by row id),
 *   hint, disabled, words ({ row, label, link, add, remove, drag, moveUp, moveDown, empty, full }), className. A new row
 *   starts empty and is added at the end; Add is off once the list is full.
 * Responsive: on a phone a row stacks its two boxes and the remove button; from 768 px the boxes sit side by side.
 *   The grip and the two arrows are 44 px targets (SortableRow).
 * Accessibility: the list is a named group; each row is named "Link 2" (words.row and its place); each box says
 *   what it is and which row; the buttons say which link they move or remove ("Move up: Buy"). Reordering works
 *   without dragging (the arrows). A problem shows an icon and words, tied to its box, not colour alone.
 * States: empty, some links, full, with errors on a row, disabled.
 * Dependencies: SortableList, SortableRow, Input, Button, IconButton, Icon, cn. Tests: site-content-parts.test.tsx;
 *   Design Lab "Admin" (S7-T10).
 * UX reference: admin-cms screen (.kvrow with "Add link"); reordering is an addition, see ADR-090.
 */
import { CircleAlert, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { SortableList, SortableRow } from "@/components/patterns/sortable-list";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type LinkRow = { id: string; label: string; href: string };

type LinkRowErrors = { label?: string; href?: string };

type LinkListWords = {
  /** Names a row with its place: "Link" makes "Link 2". */
  row: string;
  /** What the label box is for, and the link box: "Label", "Link". */
  label: string;
  link: string;
  add: string;
  /** Said before the link's name on each remove button: "Remove". */
  remove: string;
  drag: string;
  moveUp: string;
  moveDown: string;
  /** Shown instead of the rows when there are none. */
  empty: string;
  /** Shown when the list is full. */
  full: string;
};

type LinkListFieldProps = {
  title: string;
  links: readonly LinkRow[];
  onChange: (links: LinkRow[]) => void;
  max: number;
  errors?: Readonly<Record<string, LinkRowErrors>>;
  hint?: string;
  disabled?: boolean;
  words: LinkListWords;
  className?: string;
};

function RowError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="flex items-start gap-1 text-caption text-danger">
      <Icon icon={CircleAlert} size="sm" className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  );
}

function LinkListField({
  title,
  links,
  onChange,
  max,
  errors = {},
  hint,
  disabled = false,
  words,
  className,
}: LinkListFieldProps) {
  const base = useId();
  const full = links.length >= max;
  const ids = links.map((link) => link.id);

  const change = (id: string, patch: Partial<Omit<LinkRow, "id">>) =>
    onChange(links.map((link) => (link.id === id ? { ...link, ...patch } : link)));

  const reorder = (order: string[]) => {
    const byId = new Map(links.map((link) => [link.id, link]));
    onChange(order.flatMap((id) => byId.get(id) ?? []));
  };

  return (
    <div
      role="group"
      aria-label={title}
      data-slot="link-list-field"
      className={cn("flex min-w-0 flex-col gap-3", className)}
    >
      {hint ? <p className="text-small text-muted">{hint}</p> : null}
      {links.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-small text-muted">
          {words.empty}
        </p>
      ) : (
        <SortableList ids={ids} onReorder={reorder}>
          {links.map((link, index) => {
            const place = index + 1;
            const name = link.label.trim() || `${words.row} ${place}`;
            const problems = errors[link.id] ?? {};
            const labelError = `${base}-${link.id}-label-error`;
            const hrefError = `${base}-${link.id}-href-error`;
            return (
              <SortableRow
                key={link.id}
                id={link.id}
                labels={{
                  drag: `${words.drag}: ${name}`,
                  moveUp: `${words.moveUp}: ${name}`,
                  moveDown: `${words.moveDown}: ${name}`,
                }}
              >
                <div
                  role="group"
                  aria-label={`${words.row} ${place}`}
                  className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Input
                        value={link.label}
                        disabled={disabled}
                        autoComplete="off"
                        aria-label={`${words.label} ${place}`}
                        aria-invalid={problems.label ? true : undefined}
                        aria-describedby={problems.label ? labelError : undefined}
                        onChange={(event) => change(link.id, { label: event.target.value })}
                      />
                      {problems.label ? (
                        <RowError id={labelError} message={problems.label} />
                      ) : null}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Input
                        value={link.href}
                        disabled={disabled}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-label={`${words.link} ${place}`}
                        aria-invalid={problems.href ? true : undefined}
                        aria-describedby={problems.href ? hrefError : undefined}
                        onChange={(event) => change(link.id, { href: event.target.value })}
                      />
                      {problems.href ? <RowError id={hrefError} message={problems.href} /> : null}
                    </div>
                  </div>
                  <IconButton
                    aria-label={`${words.remove}: ${name}`}
                    disabled={disabled}
                    className="self-end md:self-start"
                    onClick={() => onChange(links.filter((one) => one.id !== link.id))}
                  >
                    <Icon icon={Trash2} />
                  </IconButton>
                </div>
              </SortableRow>
            );
          })}
        </SortableList>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || full}
          iconStart={<Icon icon={Plus} size="sm" />}
          onClick={() =>
            onChange([...links, { id: globalThis.crypto.randomUUID(), label: "", href: "" }])
          }
        >
          {words.add}
        </Button>
        <p className="flex items-center gap-3 text-caption text-muted">
          {full ? <span>{words.full}</span> : null}
          <span>
            {links.length} / {max}
          </span>
        </p>
      </div>
    </div>
  );
}

export { LinkListField };
export type { LinkListFieldProps, LinkListWords, LinkRow, LinkRowErrors };
