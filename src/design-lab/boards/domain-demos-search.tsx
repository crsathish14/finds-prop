"use client";

import { useState } from "react";
import {
  SearchCard,
  type SearchCardProps,
  type SearchValues,
} from "@/components/domain/search-card";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/** The twelve Chennai localities of the approved UX, which the page would normally supply. */
const LOCALITIES = [
  "OMR Sholinganallur",
  "OMR Navalur",
  "OMR Siruseri",
  "Perungudi",
  "Velachery",
  "Adyar",
  "Besant Nagar",
  "Anna Nagar",
  "T Nagar",
  "Porur",
  "Guindy",
  "Medavakkam",
];

const POPULAR = [
  { label: "Adyar", href: "#adyar" },
  { label: "Anna Nagar", href: "#anna-nagar" },
  { label: "OMR Sholinganallur", href: "#omr-sholinganallur" },
  { label: "Porur", href: "#porur" },
];

const QUICK_PICKS = { bedrooms: "#three-bhk", budget: "#budget-homes" };

type DemoProps = Partial<Omit<SearchCardProps, "onSearch" | "localityOptions">> & {
  onSearch?: (values: SearchValues) => void;
};

/** A card with a locality list that filters the twelve names as the visitor types. */
function SearchCardHost({ onSearch, ...rest }: DemoProps) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const options = LOCALITIES.filter((name) => name.toLowerCase().includes(needle)).map((name) => ({
    value: name.toLowerCase().replaceAll(" ", "-"),
    label: name,
    hint: "Chennai",
  }));
  return (
    <SearchCard
      projectsHref="#projects"
      aiSearchHref="#ai-search"
      popular={POPULAR}
      quickPickHrefs={QUICK_PICKS}
      localityMinChars={1}
      {...rest}
      onSearch={onSearch ?? (() => undefined)}
      localityOptions={options}
      onLocalityQueryChange={setQuery}
    />
  );
}

const FRAME = "w-full max-w-(--w-search-card)";

export function SearchCardDemo() {
  const [last, setLast] = useState<SearchValues | null>(null);
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Wide: one joined bar from about 930 px of card width, two rows below that">
        <div className={FRAME}>
          <SearchCardHost layout="wide" onSearch={setLast} />
        </div>
        <Text variant="caption" tone="muted">
          {last
            ? `Search pressed with: ${JSON.stringify(last)}`
            : "Press Search to see the values it hands to the page."}
        </Text>
      </Specimen>
      <Specimen label="Stacked, with values chosen (Buy, locality, Apartment, 3 BHK, up to ₹1.5 Cr)">
        <div className="w-full max-w-2xl">
          <SearchCardHost
            layout="stacked"
            defaultValues={{
              intent: "buy",
              locality: "Velachery",
              propertyType: "apartment",
              bedrooms: 3,
              maxBudget: 1_50_00_000,
            }}
          />
        </div>
      </Specimen>
      <Specimen label="Rent: the budget list is monthly rents">
        <div className={FRAME}>
          <SearchCardHost
            layout="wide"
            defaultValues={{ intent: "rent", locality: "Adyar", maxBudget: 25_000 }}
          />
        </div>
      </Specimen>
      <Specimen label="No AI link and no Popular or Quick picks (AI search off, no localities curated)">
        <div className="w-full max-w-2xl">
          <SearchCardHost
            layout="stacked"
            aiSearchHref={undefined}
            popular={[]}
            quickPickHrefs={undefined}
          />
        </div>
      </Specimen>
      <Specimen label="Long locality text (it is cut inside the box, the box never grows)">
        <div className="w-full max-w-2xl">
          <SearchCardHost
            layout="stacked"
            defaultValues={{
              locality: "OMR Sholinganallur, beside the Old Mahabalipuram Road IT corridor",
              propertyType: "plot",
            }}
          />
        </div>
      </Specimen>
      <Text tone="muted">
        Hover and keyboard focus draw a ring around the whole field, not only the text. Type in
        Locality to see the suggestions; arrow keys move, Enter picks, Escape closes. The Search
        button is never disabled: an empty search shows everything.
      </Text>
    </div>
  );
}
