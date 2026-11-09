"use client";

import { useState, type ReactNode } from "react";
import { SiteContentLayout } from "@/components/domain/site-content-layout";
import {
  SiteHeroFields,
  type SiteHeroErrors,
  type SiteHeroFieldsWords,
  type SiteHeroValues,
} from "@/components/domain/site-hero-fields";
import { SiteHeroPreview } from "@/components/domain/site-hero-preview";
import {
  SiteHomepageFields,
  type SiteHomepageErrors,
  type SiteHomepageFieldsWords,
  type SiteHomepageValues,
} from "@/components/domain/site-homepage-fields";
import { SiteHomepagePreview } from "@/components/domain/site-homepage-preview";
import {
  SiteLocalitiesEditor,
  type SiteLocalitiesWords,
  type SiteLocalityErrors,
  type SiteLocalityRow,
} from "@/components/domain/site-localities-editor";
import { Alert } from "@/components/patterns/alert";
import { Specimen } from "../frame";
import { SaveBar, tabs } from "./admin-site-content-demos";

/**
 * The Site content editor's Hero and Homepage parts in their states (S7-T10, part B2): the Hero boxes with the layout
 * choice and their preview, the Homepage switches with the localities list and their preview, and the localities
 * list on its own. Plain English text; nothing here goes anywhere. The words that are not in the approved UX files
 * are listed in ADR-096 for the owner to confirm.
 */

const STANDARD_HEADLINE = "Find the place that fits your life in Tamil Nadu.";

const HERO_WORDS: SiteHeroFieldsWords = {
  text: { title: "Text" },
  layout: {
    title: "Layout",
    description:
      "Both layouts use the same text, search and header. If no sponsor is booked, the page shows Search Desk without a banner.",
    searchDesk: { label: "Search Desk", hint: "Centred search with a banner strip underneath." },
    split: {
      label: "Split",
      hint: "Search on the left and a larger sponsored image on the right.",
    },
  },
  eyebrow: "Eyebrow",
  eyebrowHint: "A small line above the headline. Shown in the Split layout.",
  headline: "Headline",
  subtitle: "Subtitle",
  optional: "(optional)",
};

const HERO_FILLED: SiteHeroValues = {
  eyebrow: "Tamil Nadu · Homes, plots & new projects",
  title: STANDARD_HEADLINE,
  subtitle: "Shortlist, compare and enquire directly.",
  layout: "split",
};

const HERO_STANDARD: SiteHeroValues = {
  eyebrow: "",
  title: STANDARD_HEADLINE,
  subtitle: "",
  layout: "search_desk",
};

/** The preview as the page works it out: the standard headline when the box is empty. */
function heroPreview(values: SiteHeroValues): ReactNode {
  const eyebrow = values.eyebrow.trim();
  const subtitle = values.subtitle.trim();
  return (
    <SiteHeroPreview
      title={values.title.trim() || STANDARD_HEADLINE}
      layout={values.layout}
      {...(eyebrow ? { eyebrow } : {})}
      {...(subtitle ? { subtitle } : {})}
    />
  );
}

function HeroPage({
  initial,
  errors,
  top,
  saving = false,
}: {
  initial: SiteHeroValues;
  errors?: SiteHeroErrors;
  top?: ReactNode;
  saving?: boolean;
}) {
  const [values, setValues] = useState(initial);
  return (
    <SiteContentLayout
      title="Hero"
      description="The first thing visitors see on the home page."
      tabs={tabs("hero")}
      tabsLabel="Site content"
      previewLabel="Preview"
      preview={heroPreview(values)}
      {...(top ? { top } : {})}
      footer={<SaveBar saving={saving} />}
      headingLevel="h2"
    >
      <SiteHeroFields
        values={values}
        {...(errors ? { errors } : {})}
        onChange={setValues}
        disabled={saving}
        words={HERO_WORDS}
      />
    </SiteContentLayout>
  );
}

export function SiteHeroDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The Hero page: Split chosen, every box filled (choose the other layout and watch the preview and the eyebrow)">
        <HeroPage initial={HERO_FILLED} />
      </Specimen>
      <Specimen label="Search Desk with the optional boxes empty: the standard headline in the box, no eyebrow shown">
        <HeroPage initial={HERO_STANDARD} />
      </Specimen>
      <Specimen label="Saved without a headline: the box is marked and the alert says so">
        <HeroPage
          initial={{ ...HERO_FILLED, title: "" }}
          errors={{ title: "This field is required." }}
          top={
            <Alert tone="danger" title="1 thing needs attention">
              Add a headline before saving.
            </Alert>
          }
        />
      </Specimen>
      <Specimen label="Saving: every box and both layout cards are off">
        <HeroPage initial={HERO_FILLED} saving />
      </Specimen>
    </div>
  );
}

const LOCALITIES_WORDS: SiteLocalitiesWords = {
  title: "Explore by locality",
  description:
    "Tiles shown under the search. The first 4 also appear as Popular chips in the search card. Visitors who click one see homes within the radius.",
  add: "Add locality",
  limitTitle: "You've reached the limit of 8 localities",
  limitText: "Remove one to add another.",
  emptyTitle: "No localities yet",
  emptyText:
    'The "Explore by locality" section is hidden on the homepage until you add one, and the Popular chips in the search card are left out. No empty space is shown.',
  orderHint:
    "Order matters. Use the arrows (or drag the handle) to change it. Radius is how far from the place a visitor's search reaches.",
  row: "Locality",
  label: "Label",
  lat: "Latitude",
  lng: "Longitude",
  radius: "Radius",
  km: "km",
  remove: "Remove",
  drag: "Drag",
  moveUp: "Move up",
  moveDown: "Move down",
};

const HOMEPAGE_WORDS: SiteHomepageFieldsWords = {
  sections: {
    title: "Sections",
    description: "Turn sections on or off. A hidden section is not rendered at all.",
    featured: { label: "Featured listings", hint: "Up to six featured homes." },
    projectTypes: {
      label: "Browse by what matters",
      hint: "Featured, Prime, Budget and locality entry points.",
    },
    discovery: {
      label: "Explore by locality",
      hint: "The locality tiles below. Needs at least one locality.",
    },
    whyUs: { label: "Why Find Prop", hint: "Three short value points." },
    cta: { label: "Post-property call to action", hint: "The closing banner." },
  },
  localities: LOCALITIES_WORDS,
};

const RADII = [2, 3, 4, 5, 6];

const place = (
  id: string,
  label: string,
  lat: string,
  lng: string,
  radiusKm = "4",
): SiteLocalityRow => ({ id, label, lat, lng, radiusKm });

const FIVE_PLACES = [
  place("place-1", "Adyar, Chennai", "13.0067", "80.2573"),
  place("place-2", "Velachery, Chennai", "12.9815", "80.2180"),
  place("place-3", "Navalur, Chennai", "12.8458", "80.2265", "6"),
  place("place-4", "RS Puram, Coimbatore", "11.0070", "76.9490"),
  place("place-5", "KK Nagar, Madurai", "9.9470", "78.1480"),
];

const EIGHT_PLACES = [
  ...FIVE_PLACES,
  place("place-6", "Srirangam, Tiruchirappalli", "10.8630", "78.6900", "5"),
  place("place-7", "Fairlands, Salem", "11.6690", "78.1400", "5"),
  place("place-8", "Saravanampatti, Coimbatore", "11.0770", "76.9970", "5"),
];

const SWITCHES_ON = {
  showFeatured: true,
  showProjectTypes: true,
  showDiscovery: true,
  showWhyUs: true,
  showCta: true,
};

/** The preview as the page works it out: a section with nothing to show is off, the first four places are the chips. */
function homepagePreview(values: SiteHomepageValues): ReactNode {
  const labels = values.localities.map((one) => one.label.trim()).filter(Boolean);
  const section = (label: string, on: boolean) => ({ label, on });
  return (
    <SiteHomepagePreview
      sections={[
        section("Hero and search", true),
        section("Explore by locality", values.showDiscovery && labels.length > 0),
        section("Featured homes", values.showFeatured),
        section("Browse by what matters", values.showProjectTypes),
        section("Why Find Prop", values.showWhyUs),
        section("Call to action", values.showCta),
      ]}
      popular={labels.slice(0, 4)}
      tiles={labels}
      hiddenNote={{
        title: "Section hidden",
        text: "With no localities, visitors see the search card followed directly by Featured homes.",
      }}
      words={{
        popular: "Popular chips in the search card",
        explore: "Explore by locality",
        on: "On",
        off: "Off",
      }}
    />
  );
}

function HomepagePage({
  initial,
  errors,
  saving = false,
}: {
  initial: SiteHomepageValues;
  errors?: SiteHomepageErrors;
  saving?: boolean;
}) {
  const [values, setValues] = useState(initial);
  return (
    <SiteContentLayout
      title="Homepage sections"
      description="Choose which sections appear below the hero, and which localities are featured."
      tabs={tabs("homepage")}
      tabsLabel="Site content"
      previewLabel="Preview"
      preview={homepagePreview(values)}
      footer={<SaveBar saving={saving} />}
      headingLevel="h2"
    >
      <SiteHomepageFields
        values={values}
        {...(errors ? { errors } : {})}
        onChange={setValues}
        localitiesMax={8}
        radii={RADII}
        defaultRadius={3}
        disabled={saving}
        words={HOMEPAGE_WORDS}
      />
    </SiteContentLayout>
  );
}

export function SiteHomepageDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The Homepage page: every section on and five localities (switch a section, edit a place, add one)">
        <HomepagePage initial={{ ...SWITCHES_ON, localities: FIVE_PLACES }} />
      </Specimen>
      <Specimen label="Two sections off and no localities: the preview says the locality section is hidden">
        <HomepagePage
          initial={{ ...SWITCHES_ON, showWhyUs: false, showCta: false, localities: [] }}
        />
      </Specimen>
      <Specimen label="Saving: every switch, box and button is off">
        <HomepagePage initial={{ ...SWITCHES_ON, localities: FIVE_PLACES.slice(0, 2) }} saving />
      </Specimen>
    </div>
  );
}

function LocalitiesState({
  initial,
  errors,
  disabled,
}: {
  initial: SiteLocalityRow[];
  errors?: Record<string, SiteLocalityErrors>;
  disabled?: boolean;
}) {
  const [localities, setLocalities] = useState(initial);
  return (
    <div className="w-full max-w-205">
      <SiteLocalitiesEditor
        localities={localities}
        onChange={setLocalities}
        max={8}
        radii={RADII}
        defaultRadius={3}
        {...(errors ? { errors } : {})}
        {...(disabled ? { disabled } : {})}
        words={LOCALITIES_WORDS}
      />
    </div>
  );
}

export function SiteLocalitiesDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Five localities (drag the grip or use the arrows; Add locality starts a row with 3 km)">
        <LocalitiesState initial={FIVE_PLACES} />
      </Specimen>
      <Specimen label="Nothing yet: the note says what visitors see, with its own Add locality button">
        <LocalitiesState initial={[]} />
      </Specimen>
      <Specimen label="Problems on three rows: a repeated name, a missing latitude, a place outside the area">
        <LocalitiesState
          initial={[
            place("error-1", "Adyar", "13.0067", "80.2573"),
            place("error-2", "Adyar", "", "80.2180"),
            place("error-3", "Mumbai", "19.076", "72.8777"),
          ]}
          errors={{
            "error-2": {
              label: "Another row already uses this name.",
              lat: "This field is required.",
            },
            "error-3": {
              lat: "This place is outside the area the site covers. Check the latitude and longitude.",
            },
          }}
        />
      </Specimen>
      <Specimen label="At the limit of 8: Add locality is off and the notice says so; Remove still works">
        <LocalitiesState initial={EIGHT_PLACES} />
      </Specimen>
      <Specimen label="A very long name and a distance the list does not offer (7 km is kept and shown)">
        <LocalitiesState
          initial={[
            place(
              "long-1",
              "Old Mahabalipuram Road, Sholinganallur, Chennai, close to the IT corridor and the beach",
              "12.9010",
              "80.2279",
              "7",
            ),
          ]}
        />
      </Specimen>
      <Specimen label="Saving: every box and button is off">
        <LocalitiesState initial={FIVE_PLACES.slice(0, 2)} disabled />
      </Specimen>
    </div>
  );
}
