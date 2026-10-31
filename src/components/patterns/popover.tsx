"use client";

/**
 * Popover: a small floating panel anchored to a button (a filter's options, a short explanation).
 * Purpose: a panel that opens next to what it belongs to and holds a little content, built on Radix
 *   Popover so focus and Escape work. Owner: design system. For a list of actions use DropdownMenu; for
 *   a hint use Tooltip; for anything long use a Sheet.
 * Props: Popover (root), PopoverTrigger (use asChild), PopoverAnchor (position it from another
 *   element, as Combobox does), PopoverContent (align, side, sideOffset),
 *   PopoverClose.
 * Responsive: up to 320 px wide, never wider than the screen.
 * Accessibility: focus moves into the panel when it opens and returns to the trigger when it
 *   closes; Escape closes it. Keep the trigger's accessible name meaningful.
 * States: closed, open. Dependencies: radix Popover, cn.
 * Tests: overlays.test.tsx; Design Lab "Feedback" (S2-T07).
 * UX reference: ds-feedback, popover (c-core.css .popover).
 */
import { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverAnchor(props: ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverClose(props: ComponentProps<typeof PopoverPrimitive.Close>) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

function PopoverContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        sideOffset={sideOffset}
        className={cn(
          "z-menu w-80 max-w-[calc(100vw-2*var(--gutter))] rounded-lg border border-line-strong bg-surface px-4 py-4 text-small text-ink shadow-pop",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger };
