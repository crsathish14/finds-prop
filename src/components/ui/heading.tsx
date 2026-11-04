/**
 * Heading: a page or section title.
 * Purpose: one place for heading type. The level (`as`, which decides the document outline) and
 *   the size (`size`, which decides how it looks) are separate props, so a visually small h1 or a
 *   large h3 never needs a style override. Owner: design system.
 * Props: as ("h1" to "h6", required), size ("display" | "1" | "2" | "3", required), className.
 *   `Heading.Em` is italic copper emphasis inside a heading; use it at display and h1 sizes only.
 *   `TitleWithEmphasis` (title, emphasis) sets one part of a title string in `Heading.Em`; the part
 *   must appear in the title, otherwise the title is shown plain.
 * Responsive: sizes step up at md and lg through the --t-* tokens; nothing to set here.
 * Accessibility: renders the real h1 to h6 element. Do not skip levels.
 * States: none. Dependencies: cva, cn, tokens (text-display, text-h1 to text-h3, em-accent).
 * Tests: typography.test.tsx (tag, size, merge), Design Lab "Typography" (S2-T07).
 * UX reference: ds-foundations, Type.
 */
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const headingStyles = cva("text-primary", {
  variants: {
    size: {
      display: "text-display",
      "1": "text-h1",
      "2": "text-h2",
      "3": "text-h3",
    },
  },
});

type HeadingProps = Omit<ComponentProps<"h1">, "ref"> &
  Required<VariantProps<typeof headingStyles>> & {
    as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  };

function Heading({ as: Tag, size, className, ...props }: HeadingProps) {
  return <Tag className={cn(headingStyles({ size }), className)} {...props} />;
}

function HeadingEmphasis({ className, ...props }: Omit<ComponentProps<"em">, "ref">) {
  return <em className={cn("em-accent", className)} {...props} />;
}

Heading.Em = HeadingEmphasis;

/** A title with one part of it in italic copper; if that part is not in the title, the title is plain. */
function TitleWithEmphasis({ title, emphasis }: { title: string; emphasis?: string | undefined }) {
  const at = emphasis ? title.indexOf(emphasis) : -1;
  if (!emphasis || at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <Heading.Em>{emphasis}</Heading.Em>
      {title.slice(at + emphasis.length)}
    </>
  );
}

export { Heading, TitleWithEmphasis };
