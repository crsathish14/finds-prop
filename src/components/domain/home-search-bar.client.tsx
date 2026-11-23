"use client";

/**
 * HomeSearchBar: the home page's search box (owner's change of 22 Nov 2026, ADR-150): one text box and one button.
 * Purpose: the visitor writes what they want and goes on. Owner: design system. It holds only the text; it knows
 *   nothing about the chat or the results address.
 * Props: mode ("ai": the visitor describes the home and the button is "Search with AI" | "keyword": the plain
 *   search used while AI search is off), action (where the form goes when the page's script has not loaded, or in
 *   keyword mode always: a GET to this address), name (the address name of the text in keyword mode; "q" by default;
 *   AI mode sends no name, so the words never go in the address), onSearch (AI mode: called with the trimmed text,
 *   empty included, instead of the GET), maxLength, defaultValue, className, and two optional extras used by the
 *   Conversational hero (ADR-177, src/components/domain/conversational-hero.tsx): examples (sample requests the hint types out one
 *   after another while the box is empty and not focused) and suggestions (short requests shown as chips under the
 *   box; a chip puts its words in the box and moves focus there, it does not search). Without them nothing changes.
 *   appearance: "card" (default: the box and the button on a white card) | "joined" (the conversational hero: no
 *   card, the box and the button merged into one pill-shaped bar with a single border; focus shows as that border
 *   turning teal, with no outline box round the bar, as the owner asked on 23 Nov 2026).
 * Responsive: it answers to its own width (container queries). Card: under 576 px the button sits under the box at
 *   full width; from 576 px they share one row. Joined: always one row; under 448 px the button shows its icon only
 *   (its words stay for screen readers).
 * Accessibility: a form named "Property search" (role search); the box has its own label (visually hidden, the
 *   placeholder is only a hint). The AI button carries the AI motion (AiCta "pill"); it keeps its own name. The
 *   typed hint never runs for people who prefer reduced motion, stops while the tab is hidden, while the box has
 *   focus and once anything is typed; the chips are a group named by their visible "Try" label.
 * States: empty, filled, hover and focus (on the box), AI and keyword.
 * Dependencies: Input, Button, Icon, AiCta, AiSparkle, next-intl.
 * Tests: home-search-bar.test.tsx; Design Lab "Domain" (Home search bar).
 * UX reference: none; the owner's request of 22 Nov 2026 replaced the filter card of home-a and home-b.
 */
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { AiCta } from "@/components/ui/ai-cta.client";
import { AiSparkle } from "@/components/ui/ai-sparkle";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type HomeSearchBarProps = {
  mode: "ai" | "keyword";
  action: string;
  name?: string;
  onSearch?: ((text: string) => void) | undefined;
  maxLength?: number;
  defaultValue?: string;
  examples?: readonly string[] | undefined;
  suggestions?: readonly string[] | undefined;
  appearance?: "card" | "joined";
  className?: string;
};

/** The form, box and button classes of each appearance. */
const APPEARANCE = {
  card: {
    form: "flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 text-left shadow-float @xl:flex-row @xl:items-center @xl:p-4",
    input: "h-14 text-ellipsis",
    button: "w-full shrink-0 @xl:h-14 @xl:w-auto",
    label: undefined,
  },
  joined: {
    // No focus box round the bar (owner, 23 Nov 2026): focus shows as the bar's own border turning teal.
    form: cn(
      "flex items-center gap-2 rounded-pill border-[length:var(--bw-field)] border-line-input bg-surface p-2 text-left shadow-card",
      "transition-colors duration-(--dur-fast) hover:border-primary focus-within:border-primary",
    ),
    input:
      "h-12 rounded-pill border-0 bg-transparent text-ellipsis focus-visible:outline-0 @xl:h-14",
    // While the words are hidden the button is a circle; its inner row drops its gap so the icon is centred.
    button:
      "size-12 shrink-0 rounded-pill px-0 [&>span]:gap-0 @md:w-auto @md:px-6 @md:[&>span]:gap-2 @xl:h-14",
    label: "sr-only @md:not-sr-only",
  },
} as const;

/** The typed hint's pace: a letter, a letter removed, the pause on a whole example, the gap before the next. */
const TYPED_PACE = { start: 900, type: 45, erase: 22, hold: 1800, gap: 380 } as const;

function subscribeToMedia(query: string) {
  return (onChange: () => void) => {
    const list = window.matchMedia(query);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  };
}
const subscribeToReducedMotion = subscribeToMedia("(prefers-reduced-motion: reduce)");

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** True when the hint may type: the reader allows motion and the tab is on screen. False while the page is built. */
function useMotionAllowed(): boolean {
  const reduced = useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const visible = useSyncExternalStore(
    subscribeToVisibility,
    () => document.visibilityState === "visible",
    () => false,
  );
  return !reduced && visible;
}

/**
 * Types the examples out one after another and erases them again, while `running`. Returns the part on show, or
 * undefined when it is not running (the box then shows its usual hint). It goes on from the example it stopped at.
 */
function useTypedExample(examples: readonly string[], running: boolean): string | undefined {
  const [shown, setShown] = useState<string | undefined>(undefined);
  const next = useRef(0);
  const key = examples.join("\n");
  useEffect(() => {
    if (!running || key === "") return undefined;
    const list = key.split("\n");
    let length = 0;
    let erasing = false;
    let timer = 0;
    const tick = () => {
      const example = list[next.current % list.length] ?? "";
      length += erasing ? -1 : 1;
      setShown(example.slice(0, Math.max(length, 0)));
      if (!erasing && length >= example.length) {
        erasing = true;
        timer = window.setTimeout(tick, TYPED_PACE.hold);
      } else if (erasing && length <= 0) {
        erasing = false;
        next.current += 1;
        timer = window.setTimeout(tick, TYPED_PACE.gap);
      } else {
        timer = window.setTimeout(tick, erasing ? TYPED_PACE.erase : TYPED_PACE.type);
      }
    };
    timer = window.setTimeout(tick, TYPED_PACE.start);
    return () => window.clearTimeout(timer);
  }, [key, running]);
  return running ? shown : undefined;
}

function HomeSearchBar({
  mode,
  action,
  name = "q",
  onSearch,
  maxLength,
  defaultValue = "",
  examples,
  suggestions,
  appearance = "card",
  className,
}: HomeSearchBarProps) {
  const look = APPEARANCE[appearance];
  const translate = useTranslations("domain.homeSearchBar");
  const ids = useId();
  const fieldId = `${ids}-text`;
  const [text, setText] = useState(defaultValue);
  const ai = mode === "ai";
  const [focused, setFocused] = useState(false);
  const motionAllowed = useMotionAllowed();
  const typed = useTypedExample(
    examples ?? [],
    Boolean(examples?.length) && motionAllowed && !focused && text === "",
  );
  const suggestionsId = `${ids}-suggestions`;

  return (
    <div
      data-slot="home-search-bar"
      data-mode={mode}
      className={cn("@container w-full", className)}
    >
      <form
        role="search"
        aria-label={translate("label")}
        action={action}
        method="get"
        onSubmit={(event) => {
          if (!ai || !onSearch) return;
          event.preventDefault();
          onSearch(text.trim());
        }}
        data-appearance={appearance}
        className={look.form}
      >
        <label htmlFor={fieldId} className="sr-only">
          {translate(ai ? "ai.fieldLabel" : "keyword.fieldLabel")}
        </label>
        <Input
          id={fieldId}
          // AI mode keeps the words out of the address: the field has no name, so a submit before the script loads
          // opens the chat empty.
          {...(ai ? {} : { name })}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={maxLength}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={typed ?? translate(ai ? "ai.placeholder" : "keyword.placeholder")}
          leading={<Icon icon={Search} />}
          className={look.input}
        />
        {ai ? (
          <Button asChild variant="accent" size="lg" className={look.button}>
            <AiCta name="hero" variant="pill">
              {/* Button styles this through asChild: its own inner span would hold the motion's layer. */}
              <button type="submit">
                <AiSparkle />
                <span className={look.label}>{translate("ai.button")}</span>
              </button>
            </AiCta>
          </Button>
        ) : (
          <Button
            type="submit"
            variant="accent"
            size="lg"
            iconStart={<Icon icon={Search} />}
            className={look.button}
          >
            <span className={look.label}>{translate("keyword.button")}</span>
          </Button>
        )}
      </form>
      {suggestions && suggestions.length > 0 ? (
        <div
          data-slot="home-search-suggestions"
          role="group"
          aria-labelledby={suggestionsId}
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <span id={suggestionsId} className="text-caption font-semibold text-muted">
            {translate("suggestions")}
          </span>
          {suggestions.map((suggestion) => (
            <Chip
              key={suggestion}
              size="sm"
              className="max-w-full"
              onClick={() => {
                setText(suggestion);
                document.getElementById(fieldId)?.focus();
              }}
            >
              {suggestion}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export { HomeSearchBar };
export type { HomeSearchBarProps };
