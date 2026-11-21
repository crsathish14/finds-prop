/**
 * AiSparkle: the sparkle icon of the AI entry points, with two tiny secondary sparkles.
 * Purpose: the glyph that <AiCta> animates (twinkle, and the small sparkles fading in and out).
 *   On its own, outside an AiCta, it is a still icon. Owner: design system.
 * Props: size (as Icon: "sm" 16 px | "md" 20 px | "lg" 24 px), minis (the two secondary sparkles,
 *   on by default; leave them out where space is tight), className.
 * Responsive: the secondary sparkles are sized in em, so they follow the text size.
 * Accessibility: decoration only, hidden from screen readers; the control keeps its own name.
 * States: still, or animated inside AiCta. Dependencies: lucide-react, Icon, cn.
 * Tests: ai-cta.test.tsx; Design Lab "AI calls to action". Motion: src/styles/ai-cta.css.
 * UX reference: not on the UX boards; the owner's motion brief for the AI entry points (21 Nov 2026).
 */
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type AiSparkleProps = {
  size?: "sm" | "md" | "lg";
  minis?: boolean;
  className?: string;
};

function AiSparkle({ size = "sm", minis = true, className }: AiSparkleProps) {
  return (
    <span aria-hidden="true" className={cn("ai-sparkle", className)}>
      <Icon icon={Sparkles} size={size} className="ai-sparkle__glyph" />
      {minis ? (
        <>
          <span className="ai-sparkle__mini" />
          <span className="ai-sparkle__mini" />
        </>
      ) : null}
    </span>
  );
}

export { AiSparkle };
