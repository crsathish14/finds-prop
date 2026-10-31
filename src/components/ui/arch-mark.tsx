/**
 * ArchMark: the Find Prop mark, a doorway arch on a rounded square.
 * Purpose: the logo symbol, used by Logo and as a favicon-style mark. Owner: design system.
 * Props: tone ("default" forest square | "on-dark" ivory square for dark surfaces), title
 *   (already-translated name; leave it out when the mark is decoration next to the name), className.
 * Responsive: scales with its size classes (30 px in the header).
 * Accessibility: hidden from screen readers unless a title is given.
 * States: none. Dependencies: cva, cn.
 * Tests: navigation.test.tsx; Design Lab "Foundations" (S2-T07).
 * UX reference: ds-foundations, logo mark (fp.js logo-mark).
 */
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const markStyles = cva("size-7.5 shrink-0", {
  variants: {
    tone: {
      default: "[--mark-bg:var(--c-primary)] [--mark-fg:var(--c-on-primary)]",
      "on-dark": "[--mark-bg:var(--c-on-dark)] [--mark-fg:var(--c-primary-deep)]",
    },
  },
  defaultVariants: { tone: "default" },
});

type ArchMarkProps = VariantProps<typeof markStyles> & { title?: string; className?: string };

function ArchMark({ tone, title, className }: ArchMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn(markStyles({ tone }), className)}
    >
      <rect width="32" height="32" rx="9" fill="var(--mark-bg)" />
      <path
        d="M10 24v-8.5a6 6 0 0 1 12 0V24"
        fill="none"
        stroke="var(--mark-fg)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="19.2" r="2.1" fill="var(--mark-fg)" />
    </svg>
  );
}

export { ArchMark };
