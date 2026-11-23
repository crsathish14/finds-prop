"use client";

import { ConversationalHero } from "@/components/domain/conversational-hero";
import { HomeHero } from "@/components/domain/home-hero";
import { ResultsGrid } from "@/components/domain/results-list";
import { SponsorSlot } from "@/components/layout/sponsor-slot";
import { resolveHero } from "@/lib/sponsors";
import { SAMPLE_AD_A, SAMPLE_AD_B } from "@/lib/sponsors.fixtures";
import { Specimen } from "../frame";
import {
  InteractiveCard,
  PLOT_NO_PICTURE,
  RENT_PRIME,
  SALE_BUDGET,
  SALE_FEATURED,
} from "./domain-demos";
import { HomeSearchBarHost } from "./domain-demos-search";

const FRAME = "w-full rounded-xl border border-line bg-canvas";
const TRUST = ["Approved listings only", "Enquire directly", "Compare up to 3 homes"];

/**
 * The real homepage hero (S4-T07) with the banner area: Search Desk with the strip under the card, Split
 * with the panel, Split without a panel banner, which falls back to Search Desk with no gap, and Conversational
 * (ADR-176) with the strip under the trust lines and with no strip.
 */
export function HeroAsBuiltDemo() {
  const fallback = resolveHero([], "split");
  return (
    <div className="flex flex-col gap-14">
      <Specimen label="Search Desk: the strip directly under the search bar" className="w-full">
        <div className={FRAME}>
          <HomeHero
            titleAs="h2"
            id="lab-hero-desk"
            title="Find the place that fits your life in Chennai."
            emphasis="Chennai"
            subtitle="Shortlist, compare and enquire directly."
            sponsor={<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" layout="search_desk" />}
          >
            <HomeSearchBarHost />
          </HomeHero>
        </div>
      </Specimen>
      <Specimen
        label="Split: headline, search bar and trust lines on the left, the panel on the right"
        className="w-full"
      >
        <div className={FRAME}>
          <HomeHero
            titleAs="h2"
            id="lab-hero-split"
            layout="split"
            title="Find the place that fits your life in Chennai."
            emphasis="Chennai"
            subtitle="Shortlist, compare and enquire directly."
            eyebrow="Chennai · Homes, plots & new projects"
            trust={TRUST}
            sponsor={<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" layout="split" />}
          >
            <HomeSearchBarHost />
          </HomeHero>
        </div>
      </Specimen>
      <Specimen
        label="Conversational: the strip rises in last, under the trust lines (panel banners are not used here)"
        className="w-full"
      >
        <div className={FRAME}>
          <ConversationalHero
            titleAs="h2"
            id="lab-hero-conversational"
            title="Find the place that fits your life in Chennai."
            emphasis="Chennai"
            subtitle="Shortlist, compare and enquire directly."
            prompt="Ask in your own words"
            trust={TRUST}
            sponsor={<SponsorSlot ads={[SAMPLE_AD_A]} placement="hero" layout="conversational" />}
          >
            <HomeSearchBarHost appearance="joined" />
          </ConversationalHero>
        </div>
      </Specimen>
      <Specimen
        label="Split chosen but no panel banner qualifies: the page is Search Desk with nothing in the banner position"
        className="w-full"
      >
        <div className={FRAME}>
          <HomeHero
            titleAs="h2"
            id="lab-hero-fallback"
            layout={fallback.arrangement === "split" ? "split" : "search_desk"}
            title="Find the place that fits your life."
            subtitle="Shortlist, compare and enquire directly."
          >
            <HomeSearchBarHost />
          </HomeHero>
        </div>
      </Specimen>
    </div>
  );
}

/** The results list with one sponsored banner after the sixth home, across the whole row. */
export function ResultsBannerDemo() {
  const cards = [
    SALE_FEATURED,
    RENT_PRIME,
    SALE_BUDGET,
    PLOT_NO_PICTURE,
    SALE_FEATURED,
    RENT_PRIME,
  ];
  return (
    <Specimen label="Six homes, then the sponsored banner, then the next home" className="w-full">
      <div className="w-full">
        <ResultsGrid view="grid">
          {cards.map((property, index) => (
            <InteractiveCard key={`card-${index}`} property={property} />
          ))}
          <div key="sponsor" className="col-span-full">
            <SponsorSlot ads={[SAMPLE_AD_B]} placement="results" />
          </div>
          <InteractiveCard key="card-after" property={SALE_BUDGET} />
        </ResultsGrid>
      </div>
    </Specimen>
  );
}
