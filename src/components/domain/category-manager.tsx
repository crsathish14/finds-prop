/**
 * CategoryManager: the inside of the drawer where the admin adds, renames, orders, hides and deletes the categories of
 *   one list (blog articles, FAQ questions or job departments).
 * Purpose: one manager for the three modules (ADR-143, FR-ADM-14, FR-ADM-15), shown in a ManagerDrawer that the page
 *   opens from a "Categories" button. Owner: design system. It holds no state: the page keeps the rows and the form's
 *   values and passes the words, already translated, so the same part serves every module.
 * Props: rows (see CategoryRow), listLabel (names the list for a screen reader), emptyText (shown when there are none),
 *   form ({ title ("Add category" or "Edit category Buyers"), values ({ name, slug, active }), errors ({ name, slug,
 *   form }: the message of each problem), onChange, onSubmit, onCancel (only while editing; leave out when adding),
 *   pending (the form is saving: it keeps its label and does nothing twice), words ({ name, slug, slugHint, active,
 *   activeHint, submit, cancel }) }), className. A row is { id, name, slug, usage ("12 questions"), hidden, hiddenLabel
 *   ("Hidden"), editing (the form below is for this row), edit, toggle, remove ({ label (the whole name of the
 *   button), onClick }; remove has `disabled` and `reason` when the category still holds items), moveUp and moveDown
 *   ({ label, onClick, disabled }) }.
 * Responsive: a column in the drawer's width (up to 540 px, the whole screen on a phone); a row's name and slug wrap
 *   and its buttons sit on their own line under them on a phone and beside them from 768 px.
 * Accessibility: the rows are a labelled list; every icon button carries its whole name, such as "Move Buyers up";
 *   a hidden category says Hidden in words; a category in use cannot be deleted and says why in text beside the
 *   button; the form's errors are read with their boxes and the form-level error is an alert.
 * States: no categories yet; one or many; hidden; in use (delete off); being edited; the first row (Move up off) and
 *   the last (Move down off); a very long name; the form adding, editing, with problems, and saving.
 * Dependencies: FormField, Input, Switch, Label, Alert, Badge, Button, IconButton, EmptyState, cn.
 *   Tests: faq-parts.test.tsx; Design Lab "Site content" (ADR-143).
 * UX reference: none approved yet; drawn in the Design Lab for the owner to approve (ADR-143). It sits in the
 *   ManagerDrawer of the admin units screen.
 */
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";

type CategoryButton = { label: string; onClick: () => void };

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  /** What uses it, such as "12 questions" or "No questions". */
  usage: string;
  hidden: boolean;
  /** "Hidden": the word beside the dot. */
  hiddenLabel: string;
  editing?: boolean;
  /** The whole names of the buttons, such as "Edit Buyers", "Hide Buyers" and "Delete Buyers". */
  edit: CategoryButton;
  toggle: CategoryButton & { hide: boolean };
  remove: CategoryButton & { disabled?: boolean; reason?: string };
  moveUp: CategoryButton & { disabled?: boolean };
  moveDown: CategoryButton & { disabled?: boolean };
};

type CategoryFormValues = { name: string; slug: string; active: boolean };

type CategoryFormProps = {
  title: string;
  values: CategoryFormValues;
  errors?: { name?: string; slug?: string; form?: string };
  onChange: (values: CategoryFormValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  pending?: boolean;
  words: {
    name: string;
    slug: string;
    slugHint: string;
    active: string;
    activeHint: string;
    submit: string;
    cancel: string;
  };
};

type CategoryManagerProps = {
  rows: CategoryRow[];
  listLabel: string;
  emptyText: string;
  form: CategoryFormProps;
  className?: string;
};

function CategoryItem({ row, disabled }: { row: CategoryRow; disabled: boolean }) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-surface p-3 md:flex-row md:items-center md:justify-between",
        row.editing ? "border-primary" : "border-line",
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-ink [overflow-wrap:anywhere]">{row.name}</b>
          {row.hidden ? (
            <Badge dot tone="neutral">
              {row.hiddenLabel}
            </Badge>
          ) : null}
        </div>
        <p className="text-small text-muted [overflow-wrap:anywhere]">
          <span>{row.slug}</span> <span aria-hidden="true">·</span> <span>{row.usage}</span>
        </p>
        {row.remove.reason ? <p className="text-caption text-muted">{row.remove.reason}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <IconButton
          aria-label={row.moveUp.label}
          disabled={disabled || (row.moveUp.disabled ?? false)}
          onClick={row.moveUp.onClick}
        >
          <Icon icon={ArrowUp} />
        </IconButton>
        <IconButton
          aria-label={row.moveDown.label}
          disabled={disabled || (row.moveDown.disabled ?? false)}
          onClick={row.moveDown.onClick}
        >
          <Icon icon={ArrowDown} />
        </IconButton>
        <IconButton aria-label={row.edit.label} disabled={disabled} onClick={row.edit.onClick}>
          <Icon icon={Pencil} />
        </IconButton>
        <IconButton aria-label={row.toggle.label} disabled={disabled} onClick={row.toggle.onClick}>
          <Icon icon={row.toggle.hide ? EyeOff : Eye} />
        </IconButton>
        <IconButton
          aria-label={row.remove.label}
          disabled={disabled || (row.remove.disabled ?? false)}
          onClick={row.remove.onClick}
          className="text-danger"
        >
          <Icon icon={Trash2} />
        </IconButton>
      </div>
    </li>
  );
}

function CategoryManager({ rows, listLabel, emptyText, form, className }: CategoryManagerProps) {
  const pending = form.pending ?? false;
  const errors = form.errors ?? {};
  const problem = (message: string | undefined) => (message ? { error: message } : {});
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) form.onSubmit();
  }
  return (
    <div data-slot="category-manager" className={cn("flex flex-col gap-6", className)}>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-4 text-small text-muted">
          {emptyText}
        </p>
      ) : (
        <ul aria-label={listLabel} className="flex flex-col gap-2">
          {rows.map((row) => (
            <CategoryItem key={row.id} row={row} disabled={pending} />
          ))}
        </ul>
      )}
      <form
        onSubmit={submit}
        noValidate
        aria-labelledby="category-form-title"
        className="flex flex-col gap-4 rounded-xl border border-line bg-canvas-sunken p-4"
      >
        <h3 id="category-form-title" className="text-title-sm font-bold text-ink">
          {form.title}
        </h3>
        {errors.form ? <Alert tone="danger">{errors.form}</Alert> : null}
        <FormField label={form.words.name} {...problem(errors.name)}>
          <Input
            value={form.values.name}
            disabled={pending}
            maxLength={60}
            autoComplete="off"
            onChange={(event) => form.onChange({ ...form.values, name: event.target.value })}
          />
        </FormField>
        <FormField label={form.words.slug} hint={form.words.slugHint} {...problem(errors.slug)}>
          <Input
            value={form.values.slug}
            disabled={pending}
            maxLength={60}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => form.onChange({ ...form.values, slug: event.target.value })}
          />
        </FormField>
        <div className="flex items-start gap-3">
          <Switch
            id="category-active"
            checked={form.values.active}
            disabled={pending}
            onCheckedChange={(active) => form.onChange({ ...form.values, active })}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="category-active">{form.words.active}</Label>
            <p className="text-small text-muted">{form.words.activeHint}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="primary" loading={pending}>
            {form.words.submit}
          </Button>
          {form.onCancel ? (
            <Button type="button" variant="secondary" disabled={pending} onClick={form.onCancel}>
              {form.words.cancel}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export { CategoryManager };
export type {
  CategoryButton,
  CategoryFormProps,
  CategoryFormValues,
  CategoryManagerProps,
  CategoryRow,
};
