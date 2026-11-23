"use client";

import { Building2, Columns2, MapPin, MessageCircle, ShieldCheck, Star, Tag } from "lucide-react";
import { CategoryCard } from "@/components/domain/category-card";
import { DeveloperCard } from "@/components/domain/developer-card";
import { PropertyCard } from "@/components/domain/property-card";
import { ConversationalHero } from "@/components/domain/conversational-hero";
import { CtaBand } from "@/components/domain/cta-band";
import { HomeHero } from "@/components/domain/home-hero";
import { HomeSection } from "@/components/domain/home-section";
import { LocalityTile, tintAt } from "@/components/domain/locality-tile";
import { SectionGrid } from "@/components/domain/section-grid";
import { SectionHead } from "@/components/domain/section-head";
import { ValueCard } from "@/components/domain/value-card";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";
import { PLOT_NO_PICTURE, RENT_PRIME, SALE_BUDGET, SALE_FEATURED } from "./domain-demos";
import { DEVELOPERS } from "./domain-demos-places";
import { HomeSearchBarHost } from "./domain-demos-search";

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
          <HomeSearchBarHost />
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
          <HomeSearchBarHost />
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
          <HomeSearchBarHost />
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
          <HomeSearchBarHost />
        </HomeHero>
      </Specimen>
      <Text tone="muted">
        The faint arches are decoration. The sponsor strip joins under the search bar in a later
        step (S4-T07); without one the section simply ends below the bar.
      </Text>
    </div>
  );
}

/** The Conversational hero (ADR-177) in its states: with the typed hint, chips, trust lines and a strip; and bare. */
export function ConversationalHeroDemo() {
  const requests = [
    "3 BHK under 90 lakh near Adyar",
    "2 BHK to rent near Velachery",
    "Ready to move in near Porur",
  ];
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="Typed sample requests, suggestion chips, trust lines and a sponsored strip (the strip comes from the page)"
        className="w-full"
      >
        <ConversationalHero
          titleAs="h3"
          id="lab-conv-1"
          className="w-full"
          title="Find the place that fits your life in Chennai."
          emphasis="Chennai"
          subtitle="Shortlist, compare and enquire directly."
          prompt="Ask in your own words"
          trust={["Approved listings only", "Enquire directly", "Compare up to 3 homes"]}
          sponsor={<StripSample />}
        >
          <HomeSearchBarHost appearance="joined" examples={requests} suggestions={requests} />
        </ConversationalHero>
      </Specimen>
      <Specimen
        label="Bare: no line under the headline, no trust lines and no strip (no gap is left)"
        className="w-full"
      >
        <ConversationalHero
          titleAs="h3"
          id="lab-conv-2"
          className="w-full"
          title="Homes, plots and new projects across Tamil Nadu"
          prompt="Ask in your own words"
        >
          <HomeSearchBarHost appearance="joined" />
        </ConversationalHero>
      </Specimen>
      <Text tone="muted">
        The light running round the search bar and the entrance stop for people who prefer reduced
        motion, and pause while the tab is hidden.
      </Text>
    </div>
  );
}

function StripSample() {
  return (
    <aside
      aria-label="Sponsored strip"
      className="flex h-16 items-center justify-center rounded-md bg-cta-tint text-caption text-muted"
    >
      Sponsored strip
    </aside>
  );
}

const LOCALITY_NAMES = [
  "Adyar",
  "Velachery",
  "Anna Nagar",
  "OMR Sholinganallur",
  "Porur",
  "Guindy",
];

/** The four static sections as the page builds them, with sample words and sample localities. */
export function HomeSectionsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="The sections in the order of the page, each in its own labelled region"
        className="w-full"
      >
        <div className="w-full">
          <HomeSection labelledBy="lab-explore-title">
            <SectionHead
              id="lab-explore-title"
              title="Explore by locality"
              action={
                <Link href="#localities" variant="arrow">
                  See all localities
                </Link>
              }
            />
            <SectionGrid variant="tiles">
              {LOCALITY_NAMES.map((name, index) => (
                <LocalityTile
                  key={name}
                  name={name}
                  href={`#locality-${index}`}
                  tint={tintAt(index)}
                />
              ))}
            </SectionGrid>
          </HomeSection>
          <HomeSection labelledBy="lab-browse-title">
            <SectionHead id="lab-browse-title" title="Browse by what matters" />
            <SectionGrid variant="categories">
              <CategoryCard
                icon={Star}
                title="Featured"
                description="Hand-picked homes we recommend first"
                href="#featured"
                tint={1}
              />
              <CategoryCard
                icon={Building2}
                title="Prime"
                description="Premium addresses and large luxury homes"
                href="#prime"
                tint={2}
              />
              <CategoryCard
                icon={Tag}
                title="Budget"
                description="Affordable homes that fit a smaller budget"
                href="#budget"
                tint={3}
              />
              <CategoryCard
                icon={MapPin}
                title="By locality"
                description="Browse homes area by area across Chennai"
                href="#by-locality"
                tint={4}
              />
            </SectionGrid>
          </HomeSection>
          <HomeSection labelledBy="lab-why-title">
            <SectionHead id="lab-why-title" title="Why findsprop" emphasis="findsprop" />
            <SectionGrid variant="values">
              <ValueCard
                icon={ShieldCheck}
                title="Approved listings only"
                description="Homes appear on findsprop after they are approved."
              />
              <ValueCard
                icon={MessageCircle}
                title="Enquire directly"
                description="Send your details to the owner or builder, and track the reply in your dashboard."
              />
              <ValueCard
                icon={Columns2}
                title="Shortlist and compare"
                description="Save homes you like and compare up to three side by side."
              />
            </SectionGrid>
          </HomeSection>
          <HomeSection labelledBy="lab-cta-title" spacing="tight">
            <CtaBand
              id="lab-cta-title"
              title="Want to sell or rent your property?"
              description="Post your property free. Your listing is reviewed, then goes live."
              actionLabel="Post your property free"
              href="#post"
            />
          </HomeSection>
        </div>
      </Specimen>
      <Specimen
        label="The band tone, which New launches uses (the slightly darker page colour)"
        className="w-full"
      >
        <HomeSection labelledBy="lab-band-title" tone="band" className="w-full">
          <SectionHead id="lab-band-title" title="Why findsprop" emphasis="findsprop" />
          <SectionGrid variant="values">
            <ValueCard
              icon={ShieldCheck}
              title="Approved listings only"
              description="Homes appear on findsprop after they are approved."
            />
            <ValueCard
              icon={MessageCircle}
              title="Enquire directly"
              description="Send your details to the owner or builder."
            />
            <ValueCard
              icon={Columns2}
              title="Shortlist and compare"
              description="Compare up to three side by side."
            />
          </SectionGrid>
        </HomeSection>
      </Specimen>
      <Text tone="muted">
        A section with nothing to show is not drawn at all, so no gap is left: Explore by locality
        disappears when no locality is curated, and every section can be switched off in the site
        content.
      </Text>
    </div>
  );
}

/** The two sections that show cards in a grid, as the page builds them, with sample data. */
export function HomeCardSectionsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="Featured homes: property cards, 1, 2 and 3 across, with a View all link (no Save or Compare yet)"
        className="w-full"
      >
        <HomeSection labelledBy="lab-featured-title" spacing="tight" className="w-full">
          <SectionHead
            id="lab-featured-title"
            title="Featured homes"
            action={
              <Link href="#featured" variant="arrow">
                View all
              </Link>
            }
          />
          <SectionGrid variant="cards">
            <PropertyCard property={SALE_FEATURED} priority />
            <PropertyCard property={RENT_PRIME} priority />
            <PropertyCard property={SALE_BUDGET} priority />
            <PropertyCard property={PLOT_NO_PICTURE} priority />
          </SectionGrid>
        </HomeSection>
      </Specimen>
      <Specimen
        label="New launches from developers: developer cards on the darker band, with the line under the title"
        className="w-full"
      >
        <HomeSection labelledBy="lab-launches-title" tone="band" className="w-full">
          <SectionHead
            id="lab-launches-title"
            title="New launches from developers"
            description="Approved and published projects only."
            action={
              <Link href="#projects" variant="arrow">
                See all projects
              </Link>
            }
          />
          <SectionGrid variant="cards">
            {DEVELOPERS.map((developer) => (
              <DeveloperCard key={developer.name} developer={developer} />
            ))}
          </SectionGrid>
        </HomeSection>
      </Specimen>
      <Text tone="muted">
        Newest on findsprop is the Scrolling row entry above. Each of these sections is left out
        whole when it has nothing to show.
      </Text>
    </div>
  );
}
