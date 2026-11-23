/**
 * LegalDocumentFields: the boxes of the admin's legal editor: the summary, and the sections of the page in order, each
 * with a heading and its blocks (paragraphs, lists and tables).
 * Purpose: what the admin types to change the Privacy Policy or the Terms of Use (ADR-151). Owner: design system. It
 *   holds no state: the page keeps the values and the errors and passes the words, already translated. A list block is
 *   one box with one item per line. The anchor of a section is made by the page from its heading, so it is never typed
 *   here.
 * Props: values ({ summary, sections: { id, heading, blocks }[] }; every section and block carries an id the page keeps
 *   and never shows), errors (a message by key: `summary`, `<sectionId>:heading`, `<blockId>:text`, `<blockId>:items`,
 *   `<blockId>:caption`, `<blockId>:table`, `sections`), onChange (the new values), limits ({ sections, blocks, rows,
 *   columns }), disabled (while saving), words, className.
 * Responsive: one column at every width; the table scrolls sideways inside its own box. The grips, the arrows and the
 *   remove buttons are 44 px targets.
 * Accessibility: every box has a visible label tied to it; each section is a named group ("Section 2"); the buttons
 *   name what they move or remove. Sections reorder by dragging or with the arrows (SortableRow); blocks only with the
 *   arrows. A problem shows an icon and words, tied to its box, not colour alone.
 * States: no sections, some sections, at the section limit, a section at the block limit, with errors, disabled.
 * Dependencies: FormSection, FormField, Input, Textarea, Button, IconButton, Icon, SortableList, SortableRow,
 *   LegalTableEditor, cn. Tests: legal-document-fields.test.tsx; Design Lab "Site content" (ADR-151).
 * UX reference: none: the legal editor has no approved screen (ADR-151); it reuses the Site content patterns (the link
 *   list, the form sections and the save bar). Every word is unapproved.
 */
import { ArrowDown, ArrowUp, CircleAlert, Plus, Trash2 } from "lucide-react";
import { LegalTableEditor, type LegalTableWords } from "@/components/domain/legal-table-editor";
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import { SortableList, SortableRow } from "@/components/patterns/sortable-list";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type LegalBlockRow =
  | { id: string; type: "paragraph"; text: string }
  /** One item per line. */
  | { id: string; type: "list"; items: string }
  | { id: string; type: "table"; caption: string; head: string[]; rows: string[][] };

type LegalSectionRow = { id: string; heading: string; blocks: LegalBlockRow[] };

type LegalDocumentValues = { summary: string; sections: LegalSectionRow[] };

type LegalDocumentErrors = Readonly<Record<string, string>>;

type LegalDocumentLimits = { sections: number; blocks: number; rows: number; columns: number };

type LegalDocumentWords = {
  summary: { title: string; description: string; label: string };
  sections: {
    title: string;
    description: string;
    /** Names a section with its place: "Section" makes "Section 2". */
    row: string;
    heading: string;
    add: string;
    /** Said before the section's name on its remove button: "Remove". */
    remove: string;
    drag: string;
    moveUp: string;
    moveDown: string;
    empty: string;
    full: string;
  };
  blocks: {
    paragraph: string;
    list: string;
    listHint: string;
    table: string;
    addParagraph: string;
    addList: string;
    addTable: string;
    /** Said before the block's kind and place on its buttons: "Move up" makes "Move up: Paragraph 2". */
    remove: string;
    moveUp: string;
    moveDown: string;
    full: string;
  };
  table: LegalTableWords;
};

type LegalDocumentFieldsProps = {
  values: LegalDocumentValues;
  errors?: LegalDocumentErrors;
  onChange: (values: LegalDocumentValues) => void;
  limits: LegalDocumentLimits;
  disabled?: boolean;
  words: LegalDocumentWords;
  className?: string;
};

function newBlock(type: LegalBlockRow["type"]): LegalBlockRow {
  const id = globalThis.crypto.randomUUID();
  if (type === "paragraph") return { id, type, text: "" };
  if (type === "list") return { id, type, items: "" };
  return { id, type, caption: "", head: ["", ""], rows: [["", ""]] };
}

function Problem({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1 text-caption text-danger">
      <Icon icon={CircleAlert} size="sm" className="mt-px shrink-0" />
      <span>{message}</span>
    </p>
  );
}

type SectionEditorProps = {
  section: LegalSectionRow;
  place: number;
  errors: LegalDocumentErrors;
  onChange: (section: LegalSectionRow) => void;
  onRemove: () => void;
  limits: LegalDocumentLimits;
  disabled: boolean;
  words: LegalDocumentWords;
};

function SectionEditor({
  section,
  place,
  errors,
  onChange,
  onRemove,
  limits,
  disabled,
  words,
}: SectionEditorProps) {
  const { blocks } = section;
  const full = blocks.length >= limits.blocks;
  const kindName = (block: LegalBlockRow) => words.blocks[block.type];
  const setBlocks = (next: LegalBlockRow[]) => onChange({ ...section, blocks: next });
  const setBlock = (block: LegalBlockRow) =>
    setBlocks(blocks.map((one) => (one.id === block.id ? block : one)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(index + by, 0, moved);
    setBlocks(next);
  };
  const sectionName = section.heading.trim() || `${words.sections.row} ${place}`;
  const blocksError = errors[`${section.id}:blocks`];

  return (
    <div
      role="group"
      aria-label={`${words.sections.row} ${place}`}
      className="flex min-w-0 flex-col gap-4"
    >
      <FormField
        label={words.sections.heading}
        {...(errors[`${section.id}:heading`] ? { error: errors[`${section.id}:heading`] } : {})}
      >
        <Input
          value={section.heading}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => onChange({ ...section, heading: event.target.value })}
        />
      </FormField>
      {blocks.map((block, index) => {
        const name = `${kindName(block)} ${index + 1}`;
        return (
          <div
            key={block.id}
            role="group"
            aria-label={name}
            className="flex min-w-0 flex-col gap-2 rounded-lg border border-line p-3"
          >
            {block.type === "paragraph" ? (
              <FormField
                label={name}
                {...(errors[`${block.id}:text`] ? { error: errors[`${block.id}:text`] } : {})}
              >
                <Textarea
                  value={block.text}
                  disabled={disabled}
                  onChange={(event) => setBlock({ ...block, text: event.target.value })}
                />
              </FormField>
            ) : null}
            {block.type === "list" ? (
              <FormField
                label={name}
                hint={words.blocks.listHint}
                {...(errors[`${block.id}:items`] ? { error: errors[`${block.id}:items`] } : {})}
              >
                <Textarea
                  value={block.items}
                  disabled={disabled}
                  onChange={(event) => setBlock({ ...block, items: event.target.value })}
                />
              </FormField>
            ) : null}
            {block.type === "table" ? (
              <LegalTableEditor
                table={{ caption: block.caption, head: block.head, rows: block.rows }}
                disabled={disabled}
                maxRows={limits.rows}
                maxColumns={limits.columns}
                words={words.table}
                {...(errors[`${block.id}:table`] ? { error: errors[`${block.id}:table`] } : {})}
                {...(errors[`${block.id}:caption`]
                  ? { captionError: errors[`${block.id}:caption`] }
                  : {})}
                onChange={(table) => setBlock({ ...block, ...table })}
              />
            ) : null}
            <div className="flex justify-end gap-1">
              <IconButton
                aria-label={`${words.blocks.moveUp}: ${name}`}
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                <Icon icon={ArrowUp} />
              </IconButton>
              <IconButton
                aria-label={`${words.blocks.moveDown}: ${name}`}
                disabled={disabled || index === blocks.length - 1}
                onClick={() => move(index, 1)}
              >
                <Icon icon={ArrowDown} />
              </IconButton>
              <IconButton
                aria-label={`${words.blocks.remove}: ${name}`}
                disabled={disabled || blocks.length <= 1}
                onClick={() => setBlocks(blocks.filter((one) => one.id !== block.id))}
              >
                <Icon icon={Trash2} />
              </IconButton>
            </div>
          </div>
        );
      })}
      {blocksError ? <Problem message={blocksError} /> : null}
      <div className="flex flex-wrap items-center gap-3">
        {(
          [
            ["paragraph", words.blocks.addParagraph],
            ["list", words.blocks.addList],
            ["table", words.blocks.addTable],
          ] as const
        ).map(([type, label]) => (
          <Button
            key={type}
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || full}
            iconStart={<Icon icon={Plus} size="sm" />}
            onClick={() => setBlocks([...blocks, newBlock(type)])}
          >
            {label}
          </Button>
        ))}
        {full ? <span className="text-caption text-muted">{words.blocks.full}</span> : null}
        <Button
          type="button"
          variant="danger-outline"
          size="sm"
          disabled={disabled}
          className="ml-auto"
          iconStart={<Icon icon={Trash2} size="sm" />}
          onClick={onRemove}
        >
          {`${words.sections.remove}: ${sectionName}`}
        </Button>
      </div>
    </div>
  );
}

function LegalDocumentFields({
  values,
  errors = {},
  onChange,
  limits,
  disabled = false,
  words,
  className,
}: LegalDocumentFieldsProps) {
  const { sections } = values;
  const full = sections.length >= limits.sections;
  const setSections = (next: LegalSectionRow[]) => onChange({ ...values, sections: next });

  const reorder = (order: string[]) => {
    const byId = new Map(sections.map((section) => [section.id, section]));
    setSections(order.flatMap((id) => byId.get(id) ?? []));
  };

  return (
    <div data-slot="legal-document-fields" className={cn("flex min-w-0 flex-col gap-6", className)}>
      <FormSection
        id="legal-summary"
        title={words.summary.title}
        description={words.summary.description}
      >
        <FormField
          label={words.summary.label}
          {...(errors["summary"] ? { error: errors["summary"] } : {})}
        >
          <Textarea
            value={values.summary}
            disabled={disabled}
            onChange={(event) => onChange({ ...values, summary: event.target.value })}
          />
        </FormField>
      </FormSection>
      <FormSection
        id="legal-sections"
        title={words.sections.title}
        description={words.sections.description}
      >
        {sections.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-3 text-small text-muted">
            {words.sections.empty}
          </p>
        ) : (
          <SortableList ids={sections.map((section) => section.id)} onReorder={reorder}>
            {sections.map((section, index) => {
              const name = section.heading.trim() || `${words.sections.row} ${index + 1}`;
              return (
                <SortableRow
                  key={section.id}
                  id={section.id}
                  labels={{
                    drag: `${words.sections.drag}: ${name}`,
                    moveUp: `${words.sections.moveUp}: ${name}`,
                    moveDown: `${words.sections.moveDown}: ${name}`,
                  }}
                >
                  <SectionEditor
                    section={section}
                    place={index + 1}
                    errors={errors}
                    limits={limits}
                    disabled={disabled}
                    words={words}
                    onChange={(next) =>
                      setSections(sections.map((one) => (one.id === next.id ? next : one)))
                    }
                    onRemove={() => setSections(sections.filter((one) => one.id !== section.id))}
                  />
                </SortableRow>
              );
            })}
          </SortableList>
        )}
        {errors["sections"] ? <Problem message={errors["sections"]} /> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || full}
            iconStart={<Icon icon={Plus} size="sm" />}
            onClick={() =>
              setSections([
                ...sections,
                {
                  id: globalThis.crypto.randomUUID(),
                  heading: "",
                  blocks: [newBlock("paragraph")],
                },
              ])
            }
          >
            {words.sections.add}
          </Button>
          <p className="flex items-center gap-3 text-caption text-muted">
            {full ? <span>{words.sections.full}</span> : null}
            <span>
              {sections.length} / {limits.sections}
            </span>
          </p>
        </div>
      </FormSection>
    </div>
  );
}

export { LegalDocumentFields };
export type {
  LegalBlockRow,
  LegalDocumentErrors,
  LegalDocumentFieldsProps,
  LegalDocumentLimits,
  LegalDocumentValues,
  LegalDocumentWords,
  LegalSectionRow,
};
