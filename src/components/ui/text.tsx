/**
 * Text: body copy and small type.
 * Purpose: one place for non-heading type, so size, line height and colour always travel together.
 *   Owner: design system.
 * Props: variant ("body" default | "small" | "caption" | "title" | "title-sm" | "lead" | "overline"),
 *   tone ("ink" | "muted" | "subtle" | "accent" | "inherit"; each variant has a default), as ("p"
 *   default | "span" | "div"), className.
 * Responsive: body, small and caption follow the --t-* tokens. Keep prose to about 68 characters.
 * Accessibility: use the "accent" tone for small copper text (it maps to the AA-safe text-cta-text,
 *   never the copper fill colour). Nothing below 11 px (overline) or 12.5 px (sentence case).
 * States: none. Dependencies: cva, cn, tokens (text-body to text-overline).
 * Tests: typography.test.tsx (tag, variant, tone), Design Lab "Type" (S2-T07).
 * UX reference: ds-foundations, Type.
 */
import { cva } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const VARIANT_STYLES = {
  body: "text-body",
  small: "text-small",
  caption: "text-caption",
  title: "text-title",
  "title-sm": "text-title-sm",
  lead: "text-lead",
  overline: "text-overline",
} as const;

type TextVariant = keyof typeof VARIANT_STYLES;

const DEFAULT_TONE = {
  body: "ink",
  small: "ink",
  caption: "ink",
  title: "ink",
  "title-sm": "ink",
  lead: "muted",
  overline: "muted",
} as const satisfies Record<TextVariant, string>;

const textStyles = cva("", {
  variants: {
    variant: VARIANT_STYLES,
    tone: {
      ink: "text-ink",
      muted: "text-muted",
      subtle: "text-subtle",
      accent: "text-cta-text",
      inherit: "text-inherit",
    },
  },
});

type TextProps = Omit<ComponentProps<"p">, "ref"> & {
  variant?: TextVariant;
  tone?: "ink" | "muted" | "subtle" | "accent" | "inherit";
  as?: "p" | "span" | "div";
};

function Text({ as: Tag = "p", variant = "body", tone, className, ...props }: TextProps) {
  const styles = textStyles({ variant, tone: tone ?? DEFAULT_TONE[variant] });
  return <Tag className={cn(styles, className)} {...props} />;
}

export { Text };
