/**
 * Chip: a pill the reader taps to switch a choice on or off, or a link styled as a pill.
 * Purpose: filters, quick picks and suggestions. Owner: design system. For a chip with a remove
 *   button use RemovableChip.
 * Props: selected (turns it into a toggle: aria-pressed plus a tick), size ("md" 40 px | "sm" 34 px),
 *   soft (quiet parchment fill), asChild (render a link as a chip), native button props.
 * Responsive: 40 px touch height at md. A row of chips wraps, or scrolls sideways on phones.
 * Accessibility: a native button with aria-pressed, so the state is announced; the tick means the
 *   selected state is not shown by colour alone.
 * States: default, hover, focus, selected, disabled.
 * Dependencies: cva, cn, radix Slot, Icon. Tests: inputs.test.tsx; Design Lab "Chips" (S2-T07).
 * UX reference: ds-components, Chips (c-core.css .chip).
 */
import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

const chipStyles = cva(
  [
    "inline-flex shrink-0 items-center gap-2 rounded-pill border-[length:var(--bw-field)] font-semibold whitespace-nowrap",
    "transition-colors duration-(--dur-fast) hover:border-primary",
    "aria-pressed:border-primary aria-pressed:bg-primary-tint aria-pressed:text-primary",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line-strong",
  ],
  {
    variants: {
      size: {
        md: "h-(--size-chip) px-4 text-small",
        sm: "h-(--size-chip-sm) px-3 text-caption",
      },
      soft: {
        true: "border-transparent bg-canvas-sunken text-ink",
        false: "border-line-strong bg-surface text-ink",
      },
    },
    defaultVariants: { size: "md", soft: false },
  },
);

type ChipProps = Omit<ComponentProps<"button">, "ref"> &
  VariantProps<typeof chipStyles> & { selected?: boolean; asChild?: boolean };

function Chip({ className, size, soft, selected, asChild = false, children, ...props }: ChipProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      data-slot="chip"
      type={asChild ? undefined : "button"}
      aria-pressed={selected}
      className={cn(chipStyles({ size, soft }), className)}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {selected ? <Icon icon={Check} size="sm" /> : null}
          {children}
        </>
      )}
    </Component>
  );
}

export { Chip };
