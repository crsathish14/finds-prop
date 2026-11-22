"use client";

/**
 * BlogLinkTextField: a text box of an article (a paragraph, a list's items, a quote) with an "Add link" control.
 * Purpose: ADR-169 lets a paragraph, a list item and a quote hold `[label](address)` as a link. Typing that is easy to
 *   get wrong, so this opens a small form (the words the link shows, and where it goes), checks it with the same rules the
 *   save and the database use, and puts the finished `[label](address)` into the text where the cursor was, or in place
 *   of the words that were selected. Owner: design system. It keeps only what is typed into the small form; the page
 *   keeps the text.
 * Props: label, hint (the box's own), value, onValueChange, error (already translated), place (the block's place, for the
 *   button's name), rows, maxLength, disabled, and `multiline` (a list: the box is the same, its hint is the caller's).
 * Responsive: the form's two boxes stack on a phone and sit side by side from the medium width; the buttons keep 44 px
 *   targets.
 * Accessibility: the button says which block it acts on ("Add a link to block 2") and tells whether the form is open
 *   (aria-expanded); the form is a named group; each box has a label and its own error message; Enter inside a box adds
 *   the link instead of saving the whole article; Escape closes the form and puts focus back on the button; after the
 *   link is added, focus goes back to the text box with the cursor after the link.
 * States: closed, open, an error on a box, link added, disabled (while saving).
 * Dependencies: FormField, Input, Textarea, Button, Icon, next-intl, buildLink.
 * Tests: blog-editor.test.tsx; Design Lab "Blog block editor" (ADR-169).
 * UX reference: none yet; drawn for the owner's approval (ADR-169).
 */
import { Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildLink, type LinkProblem } from "@/lib/inline-links";

type BlogLinkTextFieldProps = {
  label: string;
  hint?: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string | undefined;
  place: number;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
};

/** The words of each problem (static keys, so the messages check can see them). */
const PROBLEM_WORDS = {
  label: "validation.blogLinkLabel",
  address: "validation.blogLinkAddress",
  tooLong: "validation.blogLinkTooLong",
} as const satisfies Record<LinkProblem, string>;

function BlogLinkTextField({
  label,
  hint,
  value,
  onValueChange,
  error,
  place,
  rows = 5,
  maxLength,
  disabled = false,
}: BlogLinkTextFieldProps) {
  const translate = useTranslations();
  const boxId = useId();
  const buttonId = `${boxId}-button`;
  const formId = `${boxId}-link`;
  const wordsId = `${boxId}-words`;
  const range = useRef({ start: 0, end: 0 });
  // A box nobody has put a cursor in yet has its cursor at the start: a new link then goes at the end.
  const touched = useRef(false);
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState("");
  const [address, setAddress] = useState("");
  const [problem, setProblem] = useState<LinkProblem | null>(null);

  const box = () => document.getElementById(boxId) as HTMLTextAreaElement | null;
  const focusLater = (id: string) =>
    requestAnimationFrame(() => document.getElementById(id)?.focus());

  const openForm = () => {
    const element = box();
    const start = touched.current ? (element?.selectionStart ?? value.length) : value.length;
    const end = touched.current ? (element?.selectionEnd ?? value.length) : value.length;
    range.current = { start, end };
    // Words that were selected become the link's label, so a link can be made around what is already written.
    const selected = value.slice(start, end);
    setWords(selected.includes("\n") ? "" : selected.trim());
    setAddress("");
    setProblem(null);
    setOpen(true);
    focusLater(wordsId);
  };

  const close = () => {
    setOpen(false);
    setProblem(null);
    focusLater(buttonId);
  };

  const insert = () => {
    const built = buildLink(words, address);
    if (!built.ok) {
      setProblem(built.problem);
      return;
    }
    const { start, end } = range.current;
    const next = `${value.slice(0, start)}${built.syntax}${value.slice(end)}`;
    const cursor = start + built.syntax.length;
    onValueChange(next);
    setOpen(false);
    setProblem(null);
    // After the text box has the new value, put the cursor after the link.
    requestAnimationFrame(() => {
      const element = box();
      element?.focus();
      element?.setSelectionRange(cursor, cursor);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      insert();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };

  const problemText = problem === null ? undefined : translate(PROBLEM_WORDS[problem]);
  const labelProblem = problem === "label" ? problemText : undefined;
  const addressProblem = problem === "address" || problem === "tooLong" ? problemText : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <FormField label={label} id={boxId} {...(hint ? { hint } : {})} {...(error ? { error } : {})}>
        <Textarea
          value={value}
          disabled={disabled}
          rows={rows}
          {...(maxLength ? { maxLength } : {})}
          onFocus={() => {
            touched.current = true;
          }}
          onChange={(event) => onValueChange(event.target.value)}
        />
      </FormField>
      <div>
        <Button
          id={buttonId}
          type="button"
          variant="secondary"
          size="sm"
          iconStart={<Icon icon={Link2} />}
          disabled={disabled}
          aria-expanded={open}
          aria-controls={open ? formId : undefined}
          onClick={() => (open ? close() : openForm())}
        >
          {translate("admin.blog.editor.link.add", { place })}
        </Button>
      </div>
      {open ? (
        <div
          id={formId}
          role="group"
          aria-label={translate("admin.blog.editor.link.groupLabel", { place })}
          className="flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-canvas-sunken p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label={translate("admin.blog.editor.link.label")}
              hint={translate("admin.blog.editor.link.labelHint")}
              {...(labelProblem ? { error: labelProblem } : {})}
            >
              <Input
                id={wordsId}
                value={words}
                maxLength={160}
                onChange={(event) => setWords(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </FormField>
            <FormField
              label={translate("admin.blog.editor.link.address")}
              hint={translate("admin.blog.editor.link.addressHint")}
              {...(addressProblem ? { error: addressProblem } : {})}
            >
              <Input
                value={address}
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setAddress(event.target.value)}
                onKeyDown={onKeyDown}
              />
            </FormField>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" size="sm" onClick={insert}>
              {translate("admin.blog.editor.link.insert")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => close()}>
              {translate("admin.blog.editor.link.cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { BlogLinkTextField };
