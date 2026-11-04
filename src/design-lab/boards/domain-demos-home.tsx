"use client";

import { HomeHero } from "@/components/domain/home-hero";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";
import { SearchCardHost } from "./domain-demos-search";

export function HomeHeroDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="No region set: the headline names no place (the default)" className="w-full">
        <HomeHero
          titleAs="h3"
          id="lab-hero-1"
          className="w-full"
          title="Find the place that fits your life."
          subtitle="Shortlist, compare and enquire directly."
        >
          <SearchCardHost layout="wide" />
        </HomeHero>
      </Specimen>
      <Specimen
        label="A region set in the site content: its name is the copper word"
        className="w-full"
      >
        <HomeHero
          titleAs="h3"
          id="lab-hero-2"
          className="w-full"
          title="Find the place that fits your life in Chennai."
          emphasis="Chennai"
          subtitle="Shortlist, compare and enquire directly."
        >
          <SearchCardHost layout="wide" />
        </HomeHero>
      </Specimen>
      <Specimen
        label="A headline written in the site content (shown as given, no copper word), no line under it"
        className="w-full"
      >
        <HomeHero
          titleAs="h3"
          id="lab-hero-3"
          className="w-full"
          title="Homes, plots and new projects across Tamil Nadu"
        >
          <SearchCardHost layout="wide" />
        </HomeHero>
      </Specimen>
      <Specimen label="A long headline wraps and stays centred" className="w-full">
        <HomeHero
          titleAs="h3"
          id="lab-hero-4"
          className="w-full"
          title="Find the apartment, villa or plot that fits your life and your budget in Coimbatore."
          emphasis="Coimbatore"
          subtitle="Shortlist, compare and enquire directly with owners and builders you can trust."
        >
          <SearchCardHost layout="wide" />
        </HomeHero>
      </Specimen>
      <Text tone="muted">
        The faint arches are decoration. The sponsor strip joins under the search card in a later
        step (S4-T07); without one the section simply ends below the card.
      </Text>
    </div>
  );
}
