"use client";

/**
 * HomeSearchBar: the home page's search box (owner's change of 22 Nov 2026, ADR-150): one text box and one button.
 * Purpose: the visitor writes what they want and goes on. Owner: design system. It holds only the text; it knows
 *   nothing about the chat or the results address.
 * Props: mode ("ai": the visitor describes the home and the button is "Search with AI" | "keyword": the plain
 *   search used while AI search is off), action (where the form goes when the page's script has not loaded, or in
 *   keyword mode always: a GET to this address), name (the address name of the text in keyword mode; "q" by default;
 *   AI mode sends no name, so the words never go in the address), onSearch (AI mode: called with the trimmed text,
 *   empty included, instead of the GET), maxLength, defaultValue, className.
 * Responsive: it answers to its own width (container queries). Under 576 px the button sits under the box at full
 *   width; from 576 px they share one row.
 * Accessibility: a form named "Property search" (role search); the box has its own label (visually hidden, the
 *   placeholder is only a hint). The AI button carries the AI motion (AiCta "pill"); it keeps its own name.
 * States: empty, filled, hover and focus (on the box), AI and keyword.
 * Dependencies: Input, Button, Icon, AiCta, AiSparkle, next-intl.
 * Tests: home-search-bar.test.tsx; Design Lab "Domain" (Home search bar).
 * UX reference: none; the owner's request of 22 Nov 2026 replaced the filter card of home-a and home-b.
 */
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { AiCta } from "@/components/ui/ai-cta.client";
import { AiSparkle } from "@/components/ui/ai-sparkle";
import { Button } from "@/components/ui/button";
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
  className?: string;
};

function HomeSearchBar({
  mode,
  action,
  name = "q",
  onSearch,
  maxLength,
  defaultValue = "",
  className,
}: HomeSearchBarProps) {
  const translate = useTranslations("domain.homeSearchBar");
  const ids = useId();
  const fieldId = `${ids}-text`;
  const [text, setText] = useState(defaultValue);
  const ai = mode === "ai";

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
        className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 text-left shadow-float @xl:flex-row @xl:items-center @xl:p-4"
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
          placeholder={translate(ai ? "ai.placeholder" : "keyword.placeholder")}
          leading={<Icon icon={Search} />}
          className="h-14 text-ellipsis"
        />
        {ai ? (
          <Button
            asChild
            variant="accent"
            size="lg"
            className="w-full shrink-0 @xl:h-14 @xl:w-auto"
          >
            <AiCta name="hero" variant="pill">
              {/* Button styles this through asChild: its own inner span would hold the motion's layer. */}
              <button type="submit">
                <AiSparkle />
                {translate("ai.button")}
              </button>
            </AiCta>
          </Button>
        ) : (
          <Button
            type="submit"
            variant="accent"
            size="lg"
            iconStart={<Icon icon={Search} />}
            className="w-full shrink-0 @xl:h-14 @xl:w-auto"
          >
            {translate("keyword.button")}
          </Button>
        )}
      </form>
    </div>
  );
}

export { HomeSearchBar };
export type { HomeSearchBarProps };
