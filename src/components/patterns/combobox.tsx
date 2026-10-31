"use client";

/**
 * Combobox: a text box that suggests matches as the reader types (locality search).
 * Purpose: search-as-you-type with results supplied by the caller (usually from the server), built
 *   on cmdk and a Radix popover (spike S2-SPK-01, see ADR-037). Owner: design system.
 * Props: value and onValueChange (the text in the box), onQueryChange (called after the reader
 *   stops typing for debounceMs, only once they have typed minChars characters; fetch here),
 *   options ({ value, label, hint? }), onSelect, loading, minChars (3), debounceMs (300), invalid,
 *   disabled, id, placeholder, aria-label (required) and labels ({ clear, loading, noResults,
 *   resultCount(count) }, all already-translated).
 * Responsive: the list is as wide as the box; at least 52 px per row for touch.
 * Accessibility: the input has role combobox with aria-expanded, aria-controls and
 *   aria-activedescendant (cmdk); the list is a listbox of options. Arrow keys move, Enter picks,
 *   Escape closes the list (a second Escape leaves the text alone). Focus never leaves the input.
 *   The result count is announced politely. The clear button has its own name.
 * States: idle, typing, loading, results, no results, picked, invalid, disabled.
 * Dependencies: cmdk, Popover, Input, IconButton, Icon. Tests: combobox.test.tsx;
 *   Design Lab "Fields" (S2-T07).
 * UX reference: ds-components, search card locality field; interaction-specifications section 1.
 */
import { Command } from "cmdk";
import { Search, X } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { Popover, PopoverAnchor, PopoverContent } from "./popover";

type ComboboxOption = { value: string; label: string; hint?: string };

type ComboboxLabels = {
  clear: string;
  loading: string;
  noResults: string;
  resultCount: (count: number) => string;
};

type ComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  onQueryChange: (query: string) => void;
  options: ComboboxOption[];
  onSelect: (option: ComboboxOption) => void;
  "aria-label": string;
  labels: ComboboxLabels;
  loading?: boolean;
  minChars?: number;
  debounceMs?: number;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
};

function Combobox({
  value,
  onValueChange,
  onQueryChange,
  options,
  onSelect,
  "aria-label": ariaLabel,
  labels,
  loading = false,
  minChars = 3,
  debounceMs = 300,
  invalid,
  disabled,
  id,
  placeholder,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const requestSuggestions = useEffectEvent((text: string) => onQueryChange(text));
  const typed = useRef(false);
  const query = value.trim();
  const enough = query.length >= minChars;

  // Ask for suggestions only after the reader pauses, and only for a long enough query.
  useEffect(() => {
    if (!typed.current || !enough) return;
    const timer = setTimeout(() => requestSuggestions(query), debounceMs);
    return () => clearTimeout(timer);
  }, [query, enough, debounceMs]);

  const showList = open && enough;
  const announcement = loading
    ? labels.loading
    : showList && options.length > 0
      ? labels.resultCount(options.length)
      : showList
        ? labels.noResults
        : "";

  function pick(option: ComboboxOption) {
    typed.current = false;
    onValueChange(option.label);
    onSelect(option);
    setOpen(false);
  }

  return (
    <Command
      shouldFilter={false}
      loop
      label={ariaLabel}
      className={cn("w-full", className)}
      data-slot="combobox"
    >
      <Popover open={showList}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="w-full">
            <Command.Input
              asChild
              value={value}
              onValueChange={(text) => {
                typed.current = true;
                onValueChange(text);
                setOpen(true);
              }}
            >
              <Input
                // cmdk moves focus to its list whenever the highlighted option changes, if the focused
                // element carries this attribute. That would take the cursor away from the reader
                // mid-word, so the attribute is removed (finding of spike S2-SPK-01, ADR-037).
                cmdk-input={undefined}
                id={id}
                aria-label={ariaLabel}
                aria-expanded={showList}
                placeholder={placeholder}
                invalid={invalid}
                disabled={disabled}
                autoComplete="off"
                leading={<Icon icon={Search} />}
                trailing={
                  value ? (
                    <IconButton
                      aria-label={labels.clear}
                      onClick={() => {
                        typed.current = false;
                        onValueChange("");
                        setOpen(false);
                      }}
                    >
                      <Icon icon={X} />
                    </IconButton>
                  ) : undefined
                }
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && showList) {
                    // Close the list first; a second Escape then reaches any dialog around the box.
                    event.stopPropagation();
                    setOpen(false);
                  }
                }}
              />
            </Command.Input>
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-(--radix-popover-trigger-width) p-2"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
            else setOpen(false);
          }}
          onEscapeKeyDown={() => setOpen(false)}
        >
          <Command.List>
            {loading ? <p className="px-3 py-3 text-small text-muted">{labels.loading}</p> : null}
            {!loading && options.length === 0 ? (
              <Command.Empty className="px-3 py-3 text-small text-muted">
                {labels.noResults}
              </Command.Empty>
            ) : null}
            {options.map((option) => (
              <Command.Item
                key={option.value}
                value={option.value}
                onSelect={() => pick(option)}
                className="flex min-h-(--size-control) cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-title-sm text-ink data-[selected=true]:bg-canvas-sunken"
              >
                {option.label}
                {option.hint ? (
                  <span className="text-caption font-medium text-muted">{option.hint}</span>
                ) : null}
              </Command.Item>
            ))}
          </Command.List>
        </PopoverContent>
      </Popover>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </Command>
  );
}

export { Combobox };
export type { ComboboxLabels, ComboboxOption };
