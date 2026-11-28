import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/** How long the old page stays while the new one slides in, in milliseconds (the CSS in `ai-cards.css` matches). */
export const SLIDE_MS = 250;

/** `from-below`: the new page is a newer one and slides up from the bottom; `from-above`: an older one, down from the top. */
export type SlideDirection = "from-below" | "from-above";

/**
 * Keeps the old page on screen for a moment while the new one slides in (the cards page of the AI chat, ADR-220).
 * `key` names the page being shown and `order` is its place in the conversation, so a newer page enters from below
 * and an older one from above. It returns the key of the page that is leaving (null when nothing is) and the
 * direction; the caller draws both layers. For a visitor who asked their device for less motion there is no leaving
 * page: the swap is plain.
 */
export function useSlideSwap(
  key: string,
  order: number,
  durationMs: number = SLIDE_MS,
): { leavingKey: string | null; direction: SlideDirection } {
  const reducedMotion = usePrefersReducedMotion();
  const [seen, setSeen] = useState({ key, order });
  const [leaving, setLeaving] = useState<{ key: string; direction: SlideDirection } | null>(null);

  // A new page: the page shown before it leaves (state adjusted while rendering, so no frame shows both unarranged).
  if (seen.key !== key) {
    setSeen({ key, order });
    setLeaving(
      reducedMotion
        ? null
        : { key: seen.key, direction: order >= seen.order ? "from-below" : "from-above" },
    );
  }

  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), durationMs);
    return () => window.clearTimeout(timer);
  }, [leaving, durationMs]);

  return { leavingKey: leaving?.key ?? null, direction: leaving?.direction ?? "from-below" };
}
