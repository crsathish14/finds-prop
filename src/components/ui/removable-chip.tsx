/**
 * RemovableChip: a chip with its own remove button, such as an active filter.
 * Purpose: shows one applied choice and lets the reader take it off. Owner: design system.
 * Props: onRemove (called when the x is pressed), removeLabel (required, already-translated and
 *   naming the thing, e.g. "Remove filter: 3 BHK"), children (the chip text), className.
 * Responsive: 40 px tall, the remove target is at least 40 px.
 * Accessibility: the text is plain text and the x is a separate button with its own name, so a
 *   screen reader says what will be removed.
 * States: default, hover (on the x), focus. Dependencies: cn, Icon.
 * Tests: inputs.test.tsx; Design Lab "Chips" (S2-T07).
 * UX reference: ds-components, Chips (c-core.css .chip--remove).
 */
import { X } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type RemovableChipProps = Omit<ComponentProps<"span">, "ref"> & {
  onRemove: () => void;
  removeLabel: string;
};

function RemovableChip({
  onRemove,
  removeLabel,
  className,
  children,
  ...props
}: RemovableChipProps) {
  return (
    <span
      data-slot="removable-chip"
      className={cn(
        "inline-flex h-(--size-chip) items-center gap-1 rounded-pill bg-primary-tint pl-4 text-small font-semibold whitespace-nowrap text-primary",
        className,
      )}
      {...props}
    >
      {children}
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="grid size-(--size-chip-sm) place-items-center rounded-pill transition-colors duration-(--dur-fast) hover:bg-primary-tint-2"
      >
        <Icon icon={X} size="sm" />
      </button>
    </span>
  );
}

export { RemovableChip };
