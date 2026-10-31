/**
 * IconButton: a round button that holds only an icon.
 * Purpose: close, menu, heart and gallery arrows. Owner: design system.
 * Props: aria-label (required, already-translated; the type fails without it), tone ("default" |
 *   "on-dark"), pressed (makes it a toggle: sets aria-pressed), asChild, native button props. The
 *   child is an Icon.
 * Responsive: 44 px on every screen (the touch target).
 * Accessibility: the label is the accessible name. A toggle announces its pressed state.
 * States: default, hover, focus, pressed (toggle), disabled.
 * Dependencies: cva, cn, radix Slot. Tests: navigation.test.tsx; Design Lab "Buttons" (S2-T07).
 * UX reference: ds-components (c-core.css .icon-btn).
 */
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const iconButtonStyles = cva(
  [
    "inline-grid size-(--size-icon-btn) shrink-0 place-items-center rounded-pill",
    "transition-colors duration-(--dur-fast) disabled:cursor-not-allowed disabled:text-subtle",
    "[&_svg:not([class*='size-'])]:size-6",
  ],
  {
    variants: {
      tone: {
        default:
          "text-ink hover:bg-canvas-sunken aria-pressed:bg-primary-tint aria-pressed:text-primary",
        "on-dark": "text-on-dark hover:bg-dark-hover aria-pressed:bg-dark-active",
      },
    },
    defaultVariants: { tone: "default" },
  },
);

type IconButtonProps = Omit<ComponentProps<"button">, "aria-label" | "children"> &
  VariantProps<typeof iconButtonStyles> & {
    "aria-label": string;
    pressed?: boolean;
    asChild?: boolean;
    children: ComponentProps<"button">["children"];
  };

function IconButton({ className, tone, pressed, asChild = false, ...props }: IconButtonProps) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      data-slot="icon-button"
      type={asChild ? undefined : "button"}
      aria-pressed={pressed}
      className={cn(iconButtonStyles({ tone }), className)}
      {...props}
    />
  );
}

export { IconButton };
