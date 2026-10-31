/**
 * Container: centres page content and gives it side padding that grows with the screen.
 * Purpose: every page section sits in one, so content lines up from the header to the footer.
 *   Owner: design system.
 * Props: size ("default" 1328 px | "mid" 1100 px | "narrow" 760 px), as ("div" default | "section" |
 *   "main" | "header" | "footer" | "nav"), className, native props.
 * Responsive: side padding is the --gutter token: 16, 32, 40 and 56 px from phone to desktop.
 * Accessibility: none of its own; choose the element that matches the content.
 * States: none. Dependencies: cva, cn.
 * Tests: layout.test.tsx; Design Lab "Foundations" (S2-T07).
 * UX reference: ds-foundations, layout (base.css .container).
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const containerStyles = cva("mx-auto w-full px-gutter", {
  variants: {
    size: {
      default: "max-w-[calc(var(--container)+2*var(--gutter))]",
      mid: "max-w-[calc(var(--container-mid)+2*var(--gutter))]",
      narrow: "max-w-[calc(var(--container-narrow)+2*var(--gutter))]",
    },
  },
  defaultVariants: { size: "default" },
});

type ContainerProps = Omit<ComponentProps<"div">, "ref"> &
  VariantProps<typeof containerStyles> & {
    as?: "div" | "section" | "main" | "header" | "footer" | "nav";
  };

function Container({ as: Tag = "div", size, className, ...props }: ContainerProps) {
  return <Tag className={cn(containerStyles({ size }), className)} {...props} />;
}

export { Container };
