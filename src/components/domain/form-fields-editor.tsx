"use client";

/**
 * FormFieldsEditor: the Fields box of the form editor: the questions of a form, in order, each one opened to be changed.
 * Purpose: where the admin builds a form (S7-T08, FR-ADM-08, BR-60): quick-add chips for the common questions, a row for
 *   each field that shows its label, its kind and whether it is required, and opens to a label, a key, a kind, a
 *   placeholder, the choices of a dropdown, radio group or checkbox group, the smallest and largest value or
 *   length, and Required. Fields are reordered by dragging or with the arrow buttons (every order can be changed
 *   without a drag, WCAG 2.5.7). Owner: design system. It holds no state: the page keeps the fields, which row is
 *   open and the errors, and passes the words, already translated.
 * Props: fields ({ id, label, key, type, placeholder, options (one choice a line), min, max, required }[], all text
 *   as typed; an id is kept by the page and never shown), openId (the row that is open, or none), errors (by field
 *   id: the message of each box with a problem), types ({ value, label }[] for the Type box and the kind badge),
 *   quickAdd ({ id, label }[]), onChange (id, box, value), onToggle (id), onReorder (ids), onRemove (id), onAdd,
 *   onQuickAdd (id), max (how many fields the form may hold), disabled (while saving), words, className.
 * Responsive: one column of boxes on a phone, two from 768 px. The grip, the arrows and the open button are 44 px
 *   targets (SortableRow). The chips wrap.
 * Accessibility: every row's buttons say which field they act on ("Edit field Mobile", "Move field Mobile up"); the
 *   open button is a toggle that says whether the row is open; each box has a visible label and its error is tied
 *   to it with an icon; at the limit Add field and the chips are off and a note says so; the kind and Required are
 *   words, never colour alone.
 * States: no fields, some fields, one open, a row with errors (a key already used), at the limit, disabled.
 * Dependencies: SortableList, SortableRow, FormField, Input, Textarea, NativeSelect, Switch, Chip, Badge, Button,
 *   IconButton, Icon, Alert, cn. Tests: form-parts.test.tsx; Design Lab "Forms" (S7-T08).
 * UX reference: admin-forms screen, editor, Fields (dnd, dnd-head, dnd-body, chip-row, badge, switch). The arrow
 *   buttons are the shared sortable row's (beside the grip), so the Move up and Move down buttons are not repeated
 *   inside the open row.
 */
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { SortableList, SortableRow } from "@/components/patterns/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type FormFieldDraft = {
  id: string;
  label: string;
  key: string;
  type: string;
  placeholder: string;
  /** One choice a line. */
  options: string;
  min: string;
  max: string;
  required: boolean;
};

type FormFieldBox = "label" | "key" | "type" | "placeholder" | "options" | "min" | "max";
type FormFieldErrors = Partial<Record<FormFieldBox, string>>;

type FormFieldsWords = {
  title: string;
  dragHint: string;
  quickAddLabel: string;
  add: string;
  /** The notice at the limit: a heading and a line. */
  limitTitle: string;
  limitText: string;
  emptyText: string;
  label: string;
  key: string;
  type: string;
  placeholder: string;
  options: string;
  optionsHint: string;
  min: string;
  max: string;
  required: string;
  /** The badge on a required field. */
  requiredBadge: string;
  remove: string;
  /** These name a field: "Edit field {name}", "Collapse field {name}", "Move field {name} up" and so on. */
  edit: (name: string) => string;
  collapse: (name: string) => string;
  drag: (name: string) => string;
  moveUp: (name: string) => string;
  moveDown: (name: string) => string;
  removeField: (name: string) => string;
  /** What a field with no label yet is called in those names. */
  unnamed: string;
};

type FormFieldsEditorProps = {
  fields: readonly FormFieldDraft[];
  openId: string | null;
  errors?: Readonly<Record<string, FormFieldErrors>>;
  types: { value: string; label: string }[];
  quickAdd: { id: string; label: string }[];
  onChange: (id: string, box: keyof Omit<FormFieldDraft, "id">, value: string | boolean) => void;
  onToggle: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onQuickAdd: (id: string) => void;
  max: number;
  disabled?: boolean;
  words: FormFieldsWords;
  className?: string;
};

/** The kinds of field that offer choices, and the ones that have a smallest and largest. */
const CHOICE_TYPES = ["dropdown", "radio", "checkbox"];
const LENGTH_TYPES = ["text", "textarea", "number"];
const PLACEHOLDER_TYPES = ["text", "number", "email", "textarea", "dropdown"];

function FormFieldsEditor({
  fields,
  openId,
  errors = {},
  types,
  quickAdd,
  onChange,
  onToggle,
  onReorder,
  onRemove,
  onAdd,
  onQuickAdd,
  max,
  disabled = false,
  words,
  className,
}: FormFieldsEditorProps) {
  const atLimit = fields.length >= max;
  const typeLabel = (value: string) => types.find((type) => type.value === value)?.label ?? value;

  return (
    <section
      aria-labelledby="form-fields-title"
      data-slot="form-fields-editor"
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-surface p-4 md:p-6",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="form-fields-title" className="text-title font-bold text-ink">
          {words.title}
        </h2>
        <span className="text-small text-muted">{words.dragHint}</span>
      </header>
      <div className="flex flex-col gap-2">
        <p className="text-small text-muted">{words.quickAddLabel}</p>
        <div className="flex flex-wrap gap-2">
          {quickAdd.map((preset) => (
            <Chip
              key={preset.id}
              size="sm"
              disabled={disabled || atLimit}
              onClick={() => onQuickAdd(preset.id)}
            >
              + {preset.label}
            </Chip>
          ))}
        </div>
      </div>
      {atLimit ? (
        <Alert tone="info" title={words.limitTitle}>
          {words.limitText}
        </Alert>
      ) : null}
      {fields.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong p-4 text-center text-small text-muted">
          {words.emptyText}
        </p>
      ) : (
        <SortableList ids={fields.map((field) => field.id)} onReorder={onReorder}>
          {fields.map((field) => {
            const name = field.label.trim() || words.unnamed;
            const open = openId === field.id;
            const problems = errors[field.id] ?? {};
            const hasProblem = Object.keys(problems).length > 0;
            const box = (key: FormFieldBox) => ({
              value: field[key],
              disabled,
              onChange: (event: { target: { value: string } }) =>
                onChange(field.id, key, event.target.value),
            });
            const error = (key: FormFieldBox) => (problems[key] ? { error: problems[key] } : {});
            return (
              <SortableRow
                key={field.id}
                id={field.id}
                className={cn("items-start", hasProblem && "border-danger")}
                labels={{
                  drag: words.drag(name),
                  moveUp: words.moveUp(name),
                  moveDown: words.moveDown(name),
                }}
              >
                <div className="flex min-h-11 flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 font-bold text-ink [overflow-wrap:anywhere]">
                    {name}
                  </span>
                  <Badge tone="neutral">{typeLabel(field.type)}</Badge>
                  {field.required ? <Badge tone="success">{words.requiredBadge}</Badge> : null}
                  <IconButton
                    aria-label={open ? words.collapse(name) : words.edit(name)}
                    aria-expanded={open}
                    onClick={() => onToggle(field.id)}
                  >
                    <Icon icon={open || hasProblem ? ChevronUp : ChevronDown} />
                  </IconButton>
                </div>
                {open ? (
                  <div className="mt-3 flex flex-col gap-4 border-t border-line pt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField label={words.label} required {...error("label")}>
                        <Input {...box("label")} maxLength={120} autoComplete="off" />
                      </FormField>
                      <FormField label={words.key} required {...error("key")}>
                        <Input
                          {...box("key")}
                          maxLength={40}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </FormField>
                      <FormField label={words.type} {...error("type")}>
                        <NativeSelect {...box("type")}>
                          {types.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </FormField>
                      {PLACEHOLDER_TYPES.includes(field.type) ? (
                        <FormField label={words.placeholder} {...error("placeholder")}>
                          <Input {...box("placeholder")} maxLength={120} autoComplete="off" />
                        </FormField>
                      ) : null}
                    </div>
                    {CHOICE_TYPES.includes(field.type) ? (
                      <FormField
                        label={words.options}
                        hint={words.optionsHint}
                        required={field.type !== "checkbox"}
                        {...error("options")}
                      >
                        <Textarea {...box("options")} rows={4} />
                      </FormField>
                    ) : null}
                    {LENGTH_TYPES.includes(field.type) ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField label={words.min} {...error("min")}>
                          <Input {...box("min")} inputMode="numeric" autoComplete="off" />
                        </FormField>
                        <FormField label={words.max} {...error("max")}>
                          <Input {...box("max")} inputMode="numeric" autoComplete="off" />
                        </FormField>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex min-h-11 items-center gap-3 text-ink">
                        <Switch
                          checked={field.required}
                          onCheckedChange={(checked) => onChange(field.id, "required", checked)}
                          disabled={disabled}
                        />
                        {words.required}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        disabled={disabled}
                        aria-label={words.removeField(name)}
                        iconStart={<Icon icon={Trash2} size="sm" />}
                        onClick={() => onRemove(field.id)}
                      >
                        {words.remove}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </SortableRow>
            );
          })}
        </SortableList>
      )}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || atLimit}
          iconStart={<Icon icon={Plus} size="sm" />}
          onClick={onAdd}
        >
          {words.add}
        </Button>
      </div>
    </section>
  );
}

export { FormFieldsEditor };
export type {
  FormFieldBox,
  FormFieldDraft,
  FormFieldErrors,
  FormFieldsEditorProps,
  FormFieldsWords,
};
