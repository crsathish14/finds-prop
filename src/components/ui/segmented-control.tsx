"use client";

/**
 * SegmentedControl: a short row of options where exactly one is selected.
 * Purpose: Buy / Rent, All / Buy / Rent, enquiry type, date presets. Owner: design system.
 *   Wraps Radix ToggleGroup, which gives arrow-key movement. One option stays selected: pressing
 *   the selected option does nothing.
 * Props: options ({ value, label, count? } or { href, label } for a link-tab that navigates instead
 *   of selecting, such as "New projects"), value or defaultValue, onValueChange, aria-label
 *   (required, already-translated), size ("md" | "sm"), block (full width, equal parts).
 * Responsive: pill track in parchment; "block" fills a phone-width card.
 * Accessibility: the radio group is named by aria-label; the selected item is announced as checked and
 *   the arrow keys move between items. A link-tab is an ordinary link in the same row.
 * States: default, hover, focus, selected, disabled.
 * Dependencies: radix ToggleGroup, cva, cn, Link. Tests: inputs.test.tsx; Design Lab "Chips" (S2-T07).
 * UX reference: ds-components, Segmented control (c-core.css .seg).
 */
import { cva, type VariantProps } from "class-variance-authority";
import { ToggleGroup } from "radix-ui";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Link } from "./link";

const trackStyles = cva("max-w-full gap-1 rounded-pill bg-canvas-sunken p-1", {
  variants: { block: { true: "flex w-full", false: "inline-flex" } },
  defaultVariants: { block: false },
});

const itemStyles = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-pill font-semibold whitespace-nowrap text-ink",
    "transition-colors duration-(--dur-fast) hover:bg-primary-tint",
    "data-[state=on]:bg-primary data-[state=on]:text-on-primary data-[state=on]:hover:bg-primary",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ],
  {
    variants: {
      size: { md: "h-(--size-btn-sm) px-5 text-small", sm: "h-(--size-btn-sm) px-4 text-caption" },
      block: { true: "flex-1 px-2", false: "" },
    },
    defaultVariants: { size: "md", block: false },
  },
);

type SegmentOption =
  | { value: string; label: ReactNode; count?: ReactNode; disabled?: boolean; href?: never }
  | { href: string; label: ReactNode; value?: never; count?: never; disabled?: never };

type SegmentedControlProps = VariantProps<typeof itemStyles> & {
  options: SegmentOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  "aria-label": string;
  className?: string;
};

function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  size,
  block,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps) {
  // Radix clears the value when the selected item is pressed again; a segmented control never does.
  const [ownValue, setOwnValue] = useState(defaultValue ?? "");
  const current = value ?? ownValue;
  return (
    <ToggleGroup.Root
      type="single"
      data-slot="segmented-control"
      aria-label={ariaLabel}
      value={current}
      onValueChange={(next) => {
        if (!next) return;
        setOwnValue(next);
        onValueChange?.(next);
      }}
      className={cn(trackStyles({ block }), className)}
    >
      {options.map((option) =>
        option.href !== undefined ? (
          <Link
            key={option.href}
            href={option.href}
            className={cn(itemStyles({ size, block }), "no-underline hover:no-underline")}
          >
            {option.label}
          </Link>
        ) : (
          <ToggleGroup.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={itemStyles({ size, block })}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className="font-normal">{option.count}</span>
            ) : null}
          </ToggleGroup.Item>
        ),
      )}
    </ToggleGroup.Root>
  );
}

export { SegmentedControl };
export type { SegmentOption };
