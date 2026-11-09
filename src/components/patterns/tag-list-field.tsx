"use client";

/**
 * TagListField: a list of short phrases the person types in one at a time and can take out again.
 * Purpose: the free-text lists of the project form (amenities, location advantages, nearby places; S7-T02,
 *   FR-ADM-04) and any other list of short phrases. Owner: design system. It keeps only the text being typed:
 *   the page keeps the list and passes the words, already translated.
 * Props: label, tags (the list now), onChange (the new list), max (how many the list may hold), maxLength (the
 *   longest phrase, default 80), suggestions (phrases offered as one-tap chips, left out once added), hint, error,
 *   disabled, words ({ placeholder, add, remove, suggestions, full }), className. Enter or the Add button adds
 *   what was typed (a comma does too); extra spaces are tidied, an empty phrase or one already in the list (any
 *   capitals) is ignored, and nothing is added once the list is full.
 * Responsive: the box and Add share one line; the chips wrap onto as many lines as they need.
 * Accessibility: the label is tied to the box (FormField); the list is named by the label; each chip's x says
 *   what it removes ("Remove: Clubhouse"); a count (3 / 30) shows how many are used; a full list says so in words.
 * States: empty, filled, with suggestions, full, error, disabled.
 * Dependencies: FormField, Input, Button, RemovableChip, Chip, cn. Tests: project-form-parts.test.tsx; Design Lab
 *   "Admin" (S7-T02).
 * UX reference: admin-project-form screen (the "chips-input" of Location advantages, Nearby places and Amenities).
 */
import { useState, type ComponentProps } from "react";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { RemovableChip } from "@/components/ui/removable-chip";
import { cn } from "@/lib/cn";

type TagListWords = {
  placeholder: string;
  add: string;
  /** Said before the phrase on each chip's x: "Remove". */
  remove: string;
  /** Names the suggestions: "Suggestions". */
  suggestions: string;
  /** Shown when the list is full. */
  full: string;
};

type TagListFieldProps = {
  label: string;
  tags: readonly string[];
  onChange: (tags: string[]) => void;
  max: number;
  maxLength?: number;
  suggestions?: readonly string[];
  hint?: string;
  error?: string;
  disabled?: boolean;
  words: TagListWords;
  className?: string;
};

/** The phrase as stored: spaces tidied. */
const tidy = (text: string) => text.replace(/\s+/g, " ").trim();

const sameTag = (first: string, second: string) => first.toLowerCase() === second.toLowerCase();

type TagBoxProps = Omit<ComponentProps<typeof Input>, "onChange" | "value"> & {
  draft: string;
  onDraft: (text: string) => void;
  onAdd: () => void;
  addLabel: string;
  blocked: boolean;
};

/** The box and its Add button, one control for FormField to wire (it passes id and aria-* on to the box). */
function TagBox({ draft, onDraft, onAdd, addLabel, blocked, disabled, ...props }: TagBoxProps) {
  return (
    <div className="flex items-start gap-2">
      <Input
        {...props}
        value={draft}
        disabled={disabled || blocked}
        autoComplete="off"
        onChange={(event) => {
          const text = event.target.value;
          if (text.includes(",")) {
            onDraft(text.replace(/,/g, ""));
            onAdd();
          } else onDraft(text);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onAdd();
        }}
      />
      <Button
        type="button"
        variant="secondary"
        className="h-(--size-control)"
        disabled={disabled || blocked || tidy(draft) === ""}
        onClick={onAdd}
      >
        {addLabel}
      </Button>
    </div>
  );
}

function TagListField({
  label,
  tags,
  onChange,
  max,
  maxLength = 80,
  suggestions = [],
  hint,
  error,
  disabled = false,
  words,
  className,
}: TagListFieldProps) {
  const [draft, setDraft] = useState("");
  const full = tags.length >= max;

  const add = (text: string) => {
    const next = tidy(text).slice(0, maxLength);
    if (next === "" || full || tags.some((tag) => sameTag(tag, next))) return;
    onChange([...tags, next]);
  };
  const submitDraft = () => {
    add(draft);
    setDraft("");
  };
  const offered = suggestions.filter((phrase) => !tags.some((tag) => sameTag(tag, phrase)));

  return (
    <div data-slot="tag-list-field" className={cn("flex min-w-0 flex-col gap-3", className)}>
      <FormField label={label} {...(hint ? { hint } : {})} {...(error ? { error } : {})}>
        <TagBox
          draft={draft}
          onDraft={setDraft}
          onAdd={submitDraft}
          addLabel={words.add}
          blocked={full}
          disabled={disabled}
          maxLength={maxLength}
          placeholder={words.placeholder}
          enterKeyHint="done"
        />
      </FormField>
      <p className="flex flex-wrap items-center justify-between gap-2 text-caption text-muted">
        <span>{full ? words.full : null}</span>
        <span>
          {tags.length} / {max}
        </span>
      </p>
      {tags.length > 0 ? (
        <ul aria-label={label} className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li key={tag} className="max-w-full">
              <RemovableChip
                removeLabel={`${words.remove}: ${tag}`}
                onRemove={() =>
                  disabled ? undefined : onChange(tags.filter((one) => one !== tag))
                }
                className="h-auto min-h-(--size-chip) max-w-full py-1 whitespace-normal"
              >
                {tag}
              </RemovableChip>
            </li>
          ))}
        </ul>
      ) : null}
      {offered.length > 0 && !full ? (
        <div role="group" aria-label={words.suggestions} className="flex flex-wrap gap-2">
          {offered.map((phrase) => (
            <Chip
              key={phrase}
              type="button"
              size="sm"
              soft
              disabled={disabled}
              onClick={() => add(phrase)}
            >
              {phrase}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { TagListField };
export type { TagListFieldProps, TagListWords };
