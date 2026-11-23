"use client";

import { useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTabHidden } from "./tab-pause.client";
import {
  HERO_LAB_LAYOUTS,
  HERO_LAB_PARAM,
  heroLabLetter,
  isExperiment,
  parseHeroLabLayout,
  type HeroLabLayout,
} from "./layouts";

/** Sent on the window when the switch changes the address, so every reader of the layout updates. */
const CHANGE_EVENT = "findsprop:hero-lab";

function subscribeToAddress(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The layout asked for in the address (?layout=c), or null. Null while the page is built. */
function useChosenLayout(): HeroLabLayout | null {
  return useSyncExternalStore(
    subscribeToAddress,
    () => parseHeroLabLayout(new URLSearchParams(window.location.search).get(HERO_LAB_PARAM)),
    () => null,
  );
}

/** Puts the layout in the address without a new history entry or a reload. */
function chooseLayout(layout: HeroLabLayout) {
  const address = new URL(window.location.href);
  address.searchParams.set(HERO_LAB_PARAM, heroLabLetter(layout));
  window.history.replaceState(window.history.state, "", address);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

type HeroLabProps = {
  /** The layout the super admin chose: shown when the address asks for none. */
  live: HeroLabLayout;
  /** Each layout that can be shown, already rendered on the server. A missing one is not offered. */
  heroes: Partial<Record<HeroLabLayout, ReactNode>>;
};

/**
 * HeroLab: shows one of the homepage heroes, A to D, and a small floating switch to compare them
 * (preview only: the page renders this only where the Design Lab is on). The choice lives in the
 * address (?layout=c), so a link opens the same layout; without one the live layout is shown and no
 * switch, so the page matches production. Picking a layout plays its entrance again.
 */
export function HeroLab({ live, heroes }: HeroLabProps) {
  const translate = useTranslations("heroLab.switch");
  const chosen = useChosenLayout();
  const hidden = useTabHidden();
  const layout = chosen && heroes[chosen] !== undefined ? chosen : live;
  const letters: Record<HeroLabLayout, string> = {
    desk: translate("letters.desk"),
    split: translate("letters.split"),
    conversational: translate("letters.conversational"),
    layered: translate("letters.layered"),
  };
  const names: Record<HeroLabLayout, string> = {
    desk: translate("names.desk"),
    split: translate("names.split"),
    conversational: translate("names.conversational"),
    layered: translate("names.layered"),
  };
  const options = HERO_LAB_LAYOUTS.filter((option) => heroes[option] !== undefined).map(
    (option) => ({ value: option, label: letters[option] }),
  );

  return (
    <>
      <div key={layout} data-hero-lab={layout} data-hl-paused={hidden ? "" : undefined}>
        {heroes[layout]}
      </div>
      {/* The switch appears once the address names a layout, so the plain page looks exactly like production. */}
      {chosen ? (
        <div className="hl-switch flex items-center gap-2 rounded-pill border border-line bg-surface p-1 shadow-pop">
          <SegmentedControl
            size="sm"
            aria-label={translate("label")}
            options={options}
            value={layout}
            onValueChange={(next) => {
              const picked = parseHeroLabLayout(next);
              if (picked) chooseLayout(picked);
            }}
          />
          <span className="hidden pr-3 text-caption font-semibold text-muted md:inline">
            {names[layout]}
          </span>
        </div>
      ) : null}
    </>
  );
}

/** One section that fades and rises into place the first time it scrolls into view. */
function Reveal({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setShown(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} data-hl-reveal={shown ? "shown" : "waiting"}>
      {children}
    </div>
  );
}

/**
 * The homepage sections under the hero. Under an experimental hero (C, D, E) each one reveals as it
 * scrolls into view; otherwise they are drawn exactly as the live page draws them. The reveal is
 * only ever switched on in the browser, so nothing is hidden when the script has not run.
 */
export function HeroLabSections({
  sections,
}: {
  sections: readonly { key: string; node: ReactNode }[];
}) {
  const reveal = isExperiment(useChosenLayout());
  return sections.map((section) =>
    reveal ? (
      <Reveal key={section.key}>{section.node}</Reveal>
    ) : (
      <Fragment key={section.key}>{section.node}</Fragment>
    ),
  );
}
