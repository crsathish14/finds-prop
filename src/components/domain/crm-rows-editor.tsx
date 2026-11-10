/**
 * CrmRowsEditor: a list of pairs the admin adds to and removes from (headers, body mapping, project codes).
 * Purpose: the "Headers and body" box of the CRM editor (S7-T09, FR-ADM-09): the headers sent with each call (a name and
 *   a value), the body mapping (a CRM field and what goes in it, with `{{field_key}}` from the form), and the code the
 *   CRM uses for each project (a project chosen from a list, and a code). Owner: design system. It holds no state: the
 *   page keeps the rows and the errors and passes the words, already translated. One editor draws one list; the page
 *   puts three of them in one box.
 * Props: heading (the list's name, such as "Headers"), note (a short line after the heading, such as "(use {{field_key}}
 *   from the form)"), rows ({ id, first, second, firstError, secondError, removeLabel (names the row for the button) }[]),
 *   firstLabel and secondLabel (name the two boxes for a screen reader), firstChoices (when the first box is a list:
 *   { value, label }[] with `choose` as its first choice), choose, onChange (id, side "first" | "second", value), onAdd,
 *   onRemove (id), addLabel, empty (the line shown when there are no rows), disabled (while saving), className.
 * Responsive: the two boxes and the remove button sit in one row from 768 px; on a phone the boxes stack and the remove
 *   button goes to the end of the row.
 * Accessibility: every box has a name for a screen reader (its list's word) and the row's remove button names the row;
 *   an error shows an icon and words under its box and sets the box invalid; the list is a labelled group.
 * States: no rows (the empty line), one row, many rows, a row with errors (a repeated name), the second box a list, saving
 *   (all off).
 * Dependencies: Input, NativeSelect, Button, IconButton, Icon, cn. Tests: crm-parts.test.tsx; Design Lab "CRM" (S7-T09).
 * UX reference: admin-crm screen, the editor, "Headers and body" (kvrow, Add header, Remove).
 */
import { CircleAlert, Plus, Trash2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/cn";

type CrmRow = {
  id: string;
  first: string;
  second: string;
  firstError?: string | undefined;
  secondError?: string | undefined;
  removeLabel: string;
};

type CrmRowsEditorProps = {
  heading: string;
  note?: string;
  rows: CrmRow[];
  firstLabel: string;
  secondLabel: string;
  firstChoices?: { value: string; label: string }[];
  choose?: string;
  onChange: (id: string, side: "first" | "second", value: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  addLabel: string;
  empty: string;
  disabled?: boolean;
  className?: string;
};

function CrmRowsEditor({
  heading,
  note,
  rows,
  firstLabel,
  secondLabel,
  firstChoices,
  choose,
  onChange,
  onAdd,
  onRemove,
  addLabel,
  empty,
  disabled = false,
  className,
}: CrmRowsEditorProps) {
  const headingId = useId();
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-slot="crm-rows-editor"
      className={cn("flex min-w-0 flex-col gap-3", className)}
    >
      <p id={headingId} className="text-small font-semibold text-ink">
        {heading}
        {note ? <span className="ms-2 font-normal text-muted">{note}</span> : null}
      </p>
      {rows.length === 0 ? <p className="text-small text-muted">{empty}</p> : null}
      {rows.map((row) => (
        <div
          key={row.id}
          className="grid items-start gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
        >
          <div className="flex min-w-0 flex-col gap-1">
            {firstChoices ? (
              <NativeSelect
                aria-label={firstLabel}
                aria-invalid={row.firstError ? true : undefined}
                value={row.first}
                disabled={disabled}
                onChange={(event) => onChange(row.id, "first", event.target.value)}
              >
                <option value="">{choose}</option>
                {firstChoices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </NativeSelect>
            ) : (
              <Input
                aria-label={firstLabel}
                invalid={row.firstError ? true : undefined}
                value={row.first}
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                onChange={(event) => onChange(row.id, "first", event.target.value)}
              />
            )}
            {row.firstError ? <RowError>{row.firstError}</RowError> : null}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Input
              aria-label={secondLabel}
              invalid={row.secondError ? true : undefined}
              value={row.second}
              maxLength={500}
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
              onChange={(event) => onChange(row.id, "second", event.target.value)}
            />
            {row.secondError ? <RowError>{row.secondError}</RowError> : null}
          </div>
          <IconButton
            aria-label={row.removeLabel}
            className="justify-self-end"
            disabled={disabled}
            onClick={() => onRemove(row.id)}
          >
            <Icon icon={Trash2} />
          </IconButton>
        </div>
      ))}
      <div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          iconStart={<Icon icon={Plus} size="sm" />}
          onClick={onAdd}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

function RowError({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-2 text-caption font-semibold text-danger">
      <Icon icon={CircleAlert} size="sm" className="mt-px" />
      {children}
    </p>
  );
}

export { CrmRowsEditor };
export type { CrmRow, CrmRowsEditorProps };
