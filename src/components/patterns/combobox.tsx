"use client";

/**
 * Combobox: a text box that suggests matches as the reader types (locality search).
 * Purpose: search-as-you-type with results supplied by the caller (usually from the server), built
 *   on cmdk and a Radix popover (spike S2-SPK-01, see ADR-037). Owner: design system.
 * Props: value and onValueChange (the text in the box), onQueryChange (called after the reader
 *   stops typing for debounceMs, only once they have typed minChars characters; fetch here),
 *   options ({ value, label, hint?, description?, icon? }), onSelect, loading, minChars (3), debounceMs
 *   (300), invalid, disabled, id, placeholder, aria-label (required) and labels ({ clear, loading,
 *   noResults, resultCount(count) }, all already-translated). icon (the glyph at the start of the box, a
 *   magnifier by default) and inputClassName (changes the text box itself, for a host that draws
 *   the box, such as the search card's field) are optional; without them the box is unchanged.
 *   Place suggestions (ADR-131, UX addendum ADD-07) add five optional props, all already-translated, so
 *   a combobox that passes none of them is unchanged: an option with a `description` is drawn as a
 *   place row (a round pin, the name with the typed letters marked, the rest of the address under it, an
 *   arrow on the chosen row); footer (a line at the bottom of the panel, such as the map provider's credit);
 *   idleNotices (notes shown while the reader has typed fewer than minChars letters); notices (notes shown
 *   above the options once they have: nothing found, suggestions unavailable, too many searches);
 *   fallbackOption (a last row that keeps the typed text and searches it as a keyword; picking it calls
 *   onSelect and leaves the text as it is); loadingRows (while loading, three grey rows instead of the
 *   loading line); defaultOpen (the panel starts open: for the Design Lab and tests only).
 * Responsive: the list is as wide as the box; at least 52 px per row for touch.
 * Accessibility: the input has role combobox with aria-expanded, aria-controls and
 *   aria-activedescendant (cmdk); the list is a listbox of options. Arrow keys move, Enter picks,
 *   Escape closes the list (a second Escape leaves the text alone). Focus never leaves the input.
 *   The result count (or the first note) is announced politely. The clear button has its own name.
 *   Notes are plain text in the panel, not options, so arrow keys skip them.
 * States: idle, typing, loading, results, no results, unavailable, too many searches, picked, invalid,
 *   disabled.
 * Dependencies: cmdk, Popover, Input, IconButton, Icon, Skeleton. Tests: combobox.test.tsx;
 *   Design Lab "Fields" (S2-T07) and "Place suggestions" (ADR-131).
 * UX reference: ds-components, search card locality field; interaction-specifications section 1;
 *   UX addendum ADD-07 (place-suggest).
 */
import { Command } from "cmdk";
import { ArrowRight, MapPin, Search, X, type LucideIcon } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { Popover, PopoverAnchor, PopoverContent } from "./popover";

type ComboboxOption = {
  value: string;
  label: string;
  hint?: string;
  /** The rest of the address, drawn under the name; an option with one is drawn as a place row. */
  description?: string;
  /** The glyph in the round badge of a place row (a pin by default). */
  icon?: LucideIcon;
};

type ComboboxNotice = { icon: LucideIcon; title: string; body?: string };

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
  icon?: LucideIcon;
  className?: string;
  inputClassName?: string;
  footer?: ReactNode;
  idleNotices?: readonly ComboboxNotice[];
  notices?: readonly ComboboxNotice[];
  fallbackOption?: ComboboxOption;
  loadingRows?: boolean;
  /** Start with the panel open (for the Design Lab and tests, so a state can be shown without clicking). */
  defaultOpen?: boolean;
};

const ITEM_BASE =
  "group flex min-h-(--size-control) cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-title-sm text-ink";

/** The text with the first match of the query marked; the whole text when there is none. */
function Marked({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  const at = needle === "" ? -1 : text.toLowerCase().indexOf(needle);
  if (at === -1) return <>{text}</>;
  const end = at + needle.length;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-cta-tint-2 text-ink">{text.slice(at, end)}</mark>
      {text.slice(end)}
    </>
  );
}

function PlaceRow({
  option,
  query,
  marked,
}: {
  option: ComboboxOption;
  query: string;
  marked: boolean;
}) {
  return (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-pill bg-primary-tint text-primary group-data-[selected=true]:bg-surface">
        <Icon icon={option.icon ?? MapPin} size="sm" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold">
          {marked ? <Marked text={option.label} query={query} /> : option.label}
        </span>
        <span className="truncate text-caption font-normal text-muted">{option.description}</span>
      </span>
      <Icon
        icon={ArrowRight}
        size="sm"
        className="hidden shrink-0 text-muted group-data-[selected=true]:block"
      />
    </>
  );
}

function Notice({ notice }: { notice: ComboboxNotice }) {
  return (
    <div className="flex items-start gap-3 px-3 py-3 text-small">
      <Icon icon={notice.icon} size="sm" className="mt-1 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="font-semibold text-ink">{notice.title}</p>
        {notice.body ? <p className="text-muted">{notice.body}</p> : null}
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 px-3 py-2">
          <Skeleton shape="circle" className="size-9 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton shape="text" className="w-1/2" />
            <Skeleton shape="text" className="w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

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
  icon = Search,
  className,
  inputClassName,
  footer,
  idleNotices = [],
  notices = [],
  fallbackOption,
  loadingRows = false,
  defaultOpen = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(defaultOpen);
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
  // Before the reader has typed enough, the panel opens only when there is a note to give.
  const showIdle = open && !enough && idleNotices.length > 0;
  const showPanel = showList || showIdle;
  const announcement = loading
    ? labels.loading
    : showList && options.length > 0
      ? labels.resultCount(options.length)
      : showList
        ? (notices[0]?.title ?? labels.noResults)
        : showIdle
          ? (idleNotices[0]?.title ?? "")
          : "";

  function pick(option: ComboboxOption) {
    typed.current = false;
    onValueChange(option.label);
    onSelect(option);
    setOpen(false);
  }

  /** The keyword row keeps what was typed: only the page learns that it was chosen. */
  function pickFallback(option: ComboboxOption) {
    typed.current = false;
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
      <Popover open={showPanel}>
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
                aria-expanded={showPanel}
                placeholder={placeholder}
                invalid={invalid}
                disabled={disabled}
                autoComplete="off"
                className={inputClassName}
                leading={<Icon icon={icon} />}
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
                  if (event.key === "Escape" && showPanel) {
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
            {showIdle
              ? idleNotices.map((notice) => <Notice key={notice.title} notice={notice} />)
              : null}
            {showList && !loading
              ? notices.map((notice) => <Notice key={notice.title} notice={notice} />)
              : null}
            {showList && loading ? (
              loadingRows ? (
                <LoadingRows />
              ) : (
                <p className="px-3 py-3 text-small text-muted">{labels.loading}</p>
              )
            ) : null}
            {showList && !loading && options.length === 0 && notices.length === 0 ? (
              <Command.Empty className="px-3 py-3 text-small text-muted">
                {labels.noResults}
              </Command.Empty>
            ) : null}
            {showList
              ? options.map((option) => (
                  <Command.Item
                    key={option.value}
                    value={option.value}
                    onSelect={() => pick(option)}
                    className={cn(
                      ITEM_BASE,
                      option.description
                        ? "data-[selected=true]:bg-primary-tint data-[selected=true]:outline-2 data-[selected=true]:outline-primary"
                        : "data-[selected=true]:bg-canvas-sunken",
                    )}
                  >
                    {option.description ? (
                      <PlaceRow option={option} query={query} marked />
                    ) : (
                      <>
                        {option.label}
                        {option.hint ? (
                          <span className="text-caption font-medium text-muted">{option.hint}</span>
                        ) : null}
                      </>
                    )}
                  </Command.Item>
                ))
              : null}
            {showList && !loading && fallbackOption ? (
              <>
                {options.length > 0 || notices.length > 0 ? (
                  <div aria-hidden="true" className="mx-3 my-1 h-px bg-line" />
                ) : null}
                <Command.Item
                  key={fallbackOption.value}
                  value={fallbackOption.value}
                  onSelect={() => pickFallback(fallbackOption)}
                  className={cn(
                    ITEM_BASE,
                    "data-[selected=true]:bg-primary-tint data-[selected=true]:outline-2 data-[selected=true]:outline-primary",
                  )}
                >
                  <PlaceRow
                    option={{ ...fallbackOption, icon: fallbackOption.icon ?? Search }}
                    query={query}
                    marked={false}
                  />
                </Command.Item>
              </>
            ) : null}
          </Command.List>
          {footer ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-line px-3 pt-2 text-caption text-muted">
              {footer}
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </Command>
  );
}

export { Combobox };
type ComboboxPanelProps = Pick<
  ComboboxProps,
  "labels" | "footer" | "idleNotices" | "notices" | "fallbackOption" | "loadingRows" | "defaultOpen"
>;

export type { ComboboxLabels, ComboboxNotice, ComboboxOption, ComboboxPanelProps };
