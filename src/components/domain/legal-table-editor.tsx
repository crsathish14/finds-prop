/**
 * LegalTableEditor: the boxes of one table in a legal page: its caption, its column headings and its rows of cells.
 * Purpose: the "what we collect" style tables of the Privacy Policy and the Terms of Use in the admin's legal editor
 *   (ADR-151). Owner: design system. It holds no state: the editor keeps the table and passes the words, already
 *   translated. Every row has as many cells as there are headings; adding or removing a column changes every row.
 * Props: table ({ caption, head, rows }), onChange (the new table), error (one message for the table, shown under it),
 *   captionError, disabled, maxRows, maxColumns, words ({ caption, column, cell, addRow, removeRow, addColumn,
 *   removeColumn }), className.
 * Responsive: the grid scrolls sideways inside its box when it is wider than the screen; the buttons wrap.
 * Accessibility: the grid is a focusable, named region so a keyboard can scroll it sideways even when every box is off;
 *   the table is a named group; every box names itself ("Column 2", "Cell 3.2") and the remove buttons name
 *   the row or column they remove. A problem shows an icon and words, tied to the box, not colour alone.
 * States: default, with a problem, at the row or column limit (the add button is off), one column or one row left
 *   (the remove button is off), disabled.
 * Dependencies: FormField, Input, Button, IconButton, Icon, cn. Tests: legal-document-fields.test.tsx; Design Lab
 *   "Site content" (ADR-151).
 * UX reference: none: the legal editor has no approved screen (ADR-151); it reuses the Site content patterns.
 */
import { CircleAlert, Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type LegalTableValue = { caption: string; head: string[]; rows: string[][] };

type LegalTableWords = {
  caption: string;
  /** Names a heading box with its place: "Column" makes "Column 2". */
  column: string;
  /** Names a cell with its row and column: "Cell" makes "Cell 3.2". */
  cell: string;
  addRow: string;
  /** Said before the row's place on its remove button: "Remove row" makes "Remove row 3". */
  removeRow: string;
  addColumn: string;
  removeColumn: string;
};

type LegalTableEditorProps = {
  table: LegalTableValue;
  onChange: (table: LegalTableValue) => void;
  error?: string;
  captionError?: string;
  disabled?: boolean;
  maxRows: number;
  maxColumns: number;
  words: LegalTableWords;
  className?: string;
};

function LegalTableEditor({
  table,
  onChange,
  error,
  captionError,
  disabled = false,
  maxRows,
  maxColumns,
  words,
  className,
}: LegalTableEditorProps) {
  const { head, rows } = table;
  const setHead = (column: number, value: string) =>
    onChange({ ...table, head: head.map((one, index) => (index === column ? value : one)) });
  const setCell = (row: number, column: number, value: string) =>
    onChange({
      ...table,
      rows: rows.map((cells, at) =>
        at === row ? cells.map((one, index) => (index === column ? value : one)) : cells,
      ),
    });
  const addColumn = () =>
    onChange({ ...table, head: [...head, ""], rows: rows.map((cells) => [...cells, ""]) });
  const removeColumn = (column: number) =>
    onChange({
      ...table,
      head: head.filter((_, index) => index !== column),
      rows: rows.map((cells) => cells.filter((_, index) => index !== column)),
    });
  const addRow = () => onChange({ ...table, rows: [...rows, head.map(() => "")] });
  const removeRow = (row: number) =>
    onChange({ ...table, rows: rows.filter((_, index) => index !== row) });

  return (
    <div
      role="group"
      aria-label={words.caption}
      data-slot="legal-table-editor"
      className={cn("flex min-w-0 flex-col gap-3", className)}
    >
      <FormField label={words.caption} {...(captionError ? { error: captionError } : {})}>
        <Input
          value={table.caption}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => onChange({ ...table, caption: event.target.value })}
        />
      </FormField>
      <div
        role="region"
        tabIndex={0}
        aria-label={table.caption.trim() || words.caption}
        className="overflow-x-auto rounded-md outline-none focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-primary"
      >
        <div className="flex min-w-max flex-col gap-2">
          <div className="flex items-start gap-2">
            {head.map((heading, column) => (
              <div key={column} className="flex w-44 flex-col gap-1">
                <Input
                  value={heading}
                  disabled={disabled}
                  autoComplete="off"
                  aria-label={`${words.column} ${column + 1}`}
                  className="font-semibold"
                  onChange={(event) => setHead(column, event.target.value)}
                />
                <IconButton
                  aria-label={`${words.removeColumn} ${column + 1}`}
                  disabled={disabled || head.length <= 1}
                  className="self-end"
                  onClick={() => removeColumn(column)}
                >
                  <Icon icon={Trash2} />
                </IconButton>
              </div>
            ))}
            <span className="w-11 shrink-0" aria-hidden="true" />
          </div>
          {rows.map((cells, row) => (
            <div key={row} className="flex items-start gap-2">
              {cells.map((cell, column) => (
                <Input
                  key={column}
                  value={cell}
                  disabled={disabled}
                  autoComplete="off"
                  aria-label={`${words.cell} ${row + 1}.${column + 1}`}
                  className="w-44"
                  onChange={(event) => setCell(row, column, event.target.value)}
                />
              ))}
              <IconButton
                aria-label={`${words.removeRow} ${row + 1}`}
                disabled={disabled || rows.length <= 1}
                onClick={() => removeRow(row)}
              >
                <Icon icon={Trash2} />
              </IconButton>
            </div>
          ))}
        </div>
      </div>
      {error ? (
        <p className="flex items-start gap-1 text-caption text-danger">
          <Icon icon={CircleAlert} size="sm" className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || rows.length >= maxRows}
          iconStart={<Icon icon={Plus} size="sm" />}
          onClick={addRow}
        >
          {words.addRow}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || head.length >= maxColumns}
          iconStart={<Icon icon={Plus} size="sm" />}
          onClick={addColumn}
        >
          {words.addColumn}
        </Button>
      </div>
    </div>
  );
}

export { LegalTableEditor };
export type { LegalTableEditorProps, LegalTableValue, LegalTableWords };
