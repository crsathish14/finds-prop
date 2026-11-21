"use client";

/**
 * AiCta: the motion for an AI entry point ("AI Search", "Describe it in words", "Ask about this home").
 * Purpose: one wrapper so the three AI calls to action move the same way: a twinkling sparkle, a
 *   breathing glow and an occasional shimmer that play a few times after the page loads and then
 *   settle. Owner: design system. The motion itself lives in src/styles/ai-cta.css (tune it there).
 * Props: name ("nav" | "hero" | "ask": which CTA, for the clicked-this-session flag; every nav entry
 *   shares "nav"), variant ("pill" nav pill | "text" hero text button | "outline" secondary button |
 *   "disc" bottom-bar disc | "inline" drawer link), entrance (play a one-time wiggle when it scrolls
 *   into view, and nothing before), children (exactly one element: the link or button itself).
 * Responsive: adds no box of its own (it merges onto its child), so the layout is unchanged.
 * Accessibility: changes nothing the screen reader hears; the shimmer layer is aria-hidden. Stops
 *   all motion under prefers-reduced-motion and after the visitor has clicked it once this session.
 * States: idle (loops play), entrance wait/play, calm (clicked), hover/focus (lift and glow), press.
 * Dependencies: radix Slot, cn, sessionStorage. Tests: ai-cta.test.tsx; Design Lab "AI calls to action".
 * UX reference: not on the UX boards; the owner's motion brief for the AI entry points (21 Nov 2026).
 */
import { Slot } from "radix-ui";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
  type MouseEvent,
  type ReactElement,
} from "react";
import { cn } from "@/lib/cn";

type AiCtaName = "nav" | "hero" | "ask";
type AiCtaVariant = "pill" | "text" | "outline" | "disc" | "inline";

type AiCtaProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  name: AiCtaName;
  variant: AiCtaVariant;
  entrance?: boolean;
  children: ReactElement;
};

const STORAGE_PREFIX = "findsprop.aiCta.clicked.";
const CLICKED_EVENT = "findsprop:ai-cta-clicked";
/** The variants that get the shimmer layer (the hero text button has its underline instead). */
const WITH_SWEEP: ReadonlySet<AiCtaVariant> = new Set(["pill", "outline"]);

function readClicked(name: AiCtaName): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + name) === "1";
  } catch {
    return false;
  }
}

function markClicked(name: AiCtaName) {
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + name, "1");
  } catch {
    // No storage (private mode, blocked): it simply keeps animating on the next page.
  }
  window.dispatchEvent(new Event(CLICKED_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CLICKED_EVENT, onChange);
  return () => window.removeEventListener(CLICKED_EVENT, onChange);
}

function AiCta({
  name,
  variant,
  entrance = false,
  className,
  onClick,
  children,
  ...props
}: AiCtaProps) {
  const calm = useSyncExternalStore(
    subscribe,
    () => readClicked(name),
    () => false,
  );
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<"wait" | "play">("wait");

  useEffect(() => {
    const node = ref.current;
    if (!entrance || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setPhase("play");
        observer.disconnect();
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [entrance]);

  function handleClick(event: MouseEvent<HTMLElement>) {
    onClick?.(event);
    markClicked(name);
  }

  return (
    <Slot.Root
      {...props}
      // After the spread: a parent Slot (Button asChild) passes ref={undefined}, which must not win.
      ref={ref}
      data-ai-cta={variant}
      data-ai-cta-state={calm ? "calm" : undefined}
      data-ai-cta-entrance={entrance ? phase : undefined}
      className={cn("ai-cta", className)}
      onClick={handleClick}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      {WITH_SWEEP.has(variant) ? <span aria-hidden="true" className="ai-cta__sweep" /> : null}
    </Slot.Root>
  );
}

export { AiCta };
export type { AiCtaName, AiCtaVariant };
