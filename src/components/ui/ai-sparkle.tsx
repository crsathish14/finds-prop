/**
 * AiSparkle: the sparkle icon of the AI entry points, with three tiny sparkles that burst out of it.
 * Purpose: the glyph that <AiCta> animates (a spin with a glow flash, and the small sparkles flying out).
 *   On its own, outside an AiCta, it is a still icon. Owner: design system.
 * Props: size (as Icon: "sm" 16 px | "md" 20 px | "lg" 24 px), minis (the three burst sparkles,
 *   on by default; leave them out where space is tight), className.
 * Responsive: the burst sparkles are sized from the icon size (ai-sparkle--sm/md/lg), not the text.
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
    <span aria-hidden="true" className={cn("ai-sparkle", `ai-sparkle--${size}`, className)}>
      <Icon icon={Sparkles} size={size} className="ai-sparkle__glyph" />
      {minis ? (
        <>
          <span className="ai-sparkle__mini" />
          <span className="ai-sparkle__mini" />
          <span className="ai-sparkle__mini" />
        </>
      ) : null}
    </span>
  );
}

export { AiSparkle };
