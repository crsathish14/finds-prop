"use client";

import { Building2, MapPin, MessageCircle, ShieldCheck, Star, Tag, Columns2 } from "lucide-react";
import { CategoryCard } from "@/components/domain/category-card";
import { CtaBand } from "@/components/domain/cta-band";
import { ScrollRow } from "@/components/domain/scroll-row";
import { SectionHead } from "@/components/domain/section-head";
import { ValueCard } from "@/components/domain/value-card";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";
import {
  InteractiveCard,
  PLOT_NO_PICTURE,
  RENT_PRIME,
  SALE_BUDGET,
  SALE_FEATURED,
} from "./domain-demos";

export function SectionHeadDemo() {
  return (
    <div className="flex flex-col gap-8">
      <Specimen label="A title with a link at the right (Explore by locality)" className="w-full">
        <SectionHead
          className="mb-0 w-full"
          title="Explore by locality"
          action={
            <Link href="#localities" variant="arrow">
              See all localities
            </Link>
          }
        />
      </Specimen>
      <Specimen label="A line under the title (New launches from developers)" className="w-full">
        <SectionHead
          className="mb-0 w-full"
          title="New launches from developers"
          description="Approved and published projects only."
          action={
            <Link href="#projects" variant="arrow">
              See all projects
            </Link>
          }
        />
      </Specimen>
      <Specimen label="An emphasised word (Why Find Prop) and no action" className="w-full">
        <SectionHead className="mb-0 w-full" title="Why" emphasis="Find Prop" />
      </Specimen>
      <Specimen
        label="A long title: the link drops under it instead of squeezing it"
        className="w-full max-w-sm"
      >
        <SectionHead
          className="mb-0 w-full"
          title="Homes close to the metro stations across the whole of Greater Chennai"
          action={
            <Link href="#metro" variant="arrow">
              View all
            </Link>
          }
        />
      </Specimen>
    </div>
  );
}

const CATEGORIES = [
  {
    icon: Star,
    title: "Featured",
    description: "Hand-picked homes we recommend first",
  },
  {
    icon: Building2,
    title: "Prime",
    description: "Premium addresses and large luxury homes",
  },
  {
    icon: Tag,
    title: "Budget",
    description: "Affordable homes that fit a smaller budget",
  },
  {
    icon: MapPin,
    title: "By locality",
    description: "Browse homes area by area across Chennai",
  },
] as const;

const CATEGORY_GRID = "grid w-full gap-4 md:grid-cols-2 portal:grid-cols-4 portal:gap-5";

export function CategoryCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Text variant="overline">
          The four tints in order; hover lifts a card and moves the arrow, Tab reaches each one
        </Text>
        <div className={CATEGORY_GRID}>
          {CATEGORIES.map((category, index) => (
            <CategoryCard
              key={category.title}
              icon={category.icon}
              title={category.title}
              description={category.description}
              href={`#category-${index + 1}`}
              tint={(index + 1) as 1 | 2 | 3 | 4}
            />
          ))}
        </div>
      </div>
      <Specimen
        label="Long text: the description wraps and the card grows"
        className="w-full max-w-xs"
      >
        <CategoryCard
          icon={MapPin}
          title="By locality and by nearby metro station"
          description="Browse homes area by area across the whole of Greater Chennai and its suburbs"
          href="#category-5"
          tint={3}
        />
      </Specimen>
    </div>
  );
}

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Approved listings only",
    description: "Homes appear on Find Prop after they are approved.",
  },
  {
    icon: MessageCircle,
    title: "Enquire directly",
    description:
      "Send your details to the owner or builder, and track the reply in your dashboard.",
  },
  {
    icon: Columns2,
    title: "Shortlist and compare",
    description: "Save homes you like and compare up to three side by side.",
  },
] as const;

export function ValueCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid w-full gap-4 md:grid-cols-3 md:gap-5">
        {VALUES.map((value) => (
          <ValueCard
            key={value.title}
            icon={value.icon}
            title={value.title}
            description={value.description}
          />
        ))}
      </div>
      <Specimen label="Long text: the card grows to fit" className="w-full max-w-xs">
        <ValueCard
          icon={ShieldCheck}
          title="Every listing is read by a person before it goes live, every time"
          description="Homes appear on Find Prop after they are approved, and a listing that changes is approved again before the change shows."
        />
      </Specimen>
    </div>
  );
}

export function CtaBandDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Text variant="overline">Stacked on a phone, side by side from 768 px</Text>
        <CtaBand
          title="Want to sell or rent your property?"
          description="Post your property free. Your listing is reviewed, then goes live."
          actionLabel="Post your property free"
          href="#post"
          className="w-full"
        />
      </div>
      <Specimen label="Without a line under the title" className="w-full">
        <CtaBand
          title="Want to sell or rent your property?"
          actionLabel="Post your property free"
          href="#post"
          className="w-full"
        />
      </Specimen>
    </div>
  );
}

export function ScrollRowDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Text variant="overline">
          Newest on Find Prop: swipe on a phone; from 768 px the buttons show and Previous starts
          disabled
        </Text>
        <ScrollRow title="Newest on Find Prop" label="Newest homes">
          <InteractiveCard property={SALE_BUDGET} />
          <InteractiveCard property={RENT_PRIME} />
          <InteractiveCard property={SALE_FEATURED} />
          <InteractiveCard property={PLOT_NO_PICTURE} />
          <InteractiveCard property={RENT_PRIME} startSaved />
          <InteractiveCard property={SALE_BUDGET} />
        </ScrollRow>
      </div>
      <Specimen
        label="One card only: nothing to scroll, so both buttons are disabled"
        className="w-full"
      >
        <ScrollRow title="Newest on Find Prop" label="Newest homes (one)" className="w-full">
          <InteractiveCard property={SALE_FEATURED} />
        </ScrollRow>
      </Specimen>
    </div>
  );
}
