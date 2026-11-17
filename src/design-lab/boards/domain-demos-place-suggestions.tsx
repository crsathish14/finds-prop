"use client";

import { SearchCard } from "@/components/domain/search-card";
import { usePlacePanel, type PlacePanelState } from "@/components/domain/place-panel";
import type { ComboboxOption } from "@/components/patterns/combobox";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/** Sample suggestions as the place lookup would give them (the names are real Chennai areas). */
const VELACHERY: ComboboxOption[] = [
  { value: "velachery", label: "Velachery", description: "Chennai, Tamil Nadu · 600042" },
  {
    value: "velachery-main-road",
    label: "Velachery Main Road",
    description: "Velachery, Chennai · 600042",
  },
  {
    value: "velachery-mrts",
    label: "Velachery MRTS Station",
    description: "Velachery, Chennai · 600042",
  },
  { value: "vellore", label: "Vellore", description: "Vellore, Tamil Nadu" },
  { value: "velankanni", label: "Velankanni", description: "Nagapattinam, Tamil Nadu" },
];

type StateSpec = {
  label: string;
  state: PlacePanelState;
  query: string;
  options: ComboboxOption[];
  loading?: boolean;
  layout?: "wide" | "stacked";
};

const STATES: StateSpec[] = [
  { label: "Idle: the box is focused and empty", state: "ready", query: "", options: [] },
  { label: "Typing: fewer than three letters", state: "ready", query: "Ve", options: [] },
  { label: "Loading", state: "ready", query: "Vel", options: [], loading: true },
  { label: "Results", state: "ready", query: "Vel", options: VELACHERY },
  { label: "No results, with the keyword row", state: "empty", query: "Velxy", options: [] },
  {
    label: "Suggestions unavailable, with the keyword row",
    state: "unavailable",
    query: "Velachery",
    options: [],
  },
  { label: "Too many searches", state: "limited", query: "Vel", options: [] },
  {
    label: "Stacked card, results",
    state: "ready",
    query: "Vel",
    options: VELACHERY,
    layout: "stacked",
  },
];

/** One search card with its place panel open in a given state. Space under it keeps the panel off the next specimen. */
function PanelCard({ spec }: { spec: StateSpec }) {
  const panel = usePlacePanel(spec.state, spec.query);
  return (
    <div className="h-120 w-full max-w-(--w-search-card)">
      <SearchCard
        layout={spec.layout ?? "wide"}
        projectsHref="#projects"
        defaultValues={{ locality: spec.query }}
        localityOptions={spec.options}
        onLocalityQueryChange={() => undefined}
        localityLoading={spec.loading ?? false}
        localityMinChars={3}
        localityPanel={{ ...panel, defaultOpen: true }}
        onSearch={() => undefined}
      />
    </div>
  );
}

function PickedCard() {
  const panel = usePlacePanel("ready", "Velachery, Chennai");
  return (
    <div className="w-full max-w-(--w-search-card)">
      <SearchCard
        layout="wide"
        projectsHref="#projects"
        defaultValues={{ locality: "Velachery, Chennai" }}
        localityOptions={[]}
        onLocalityQueryChange={() => undefined}
        localityMinChars={3}
        localityPanel={panel}
        onSearch={() => undefined}
      />
    </div>
  );
}

export function PlaceSuggestionsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The place panel of the search box (ADR-131, UX addendum ADD-07). Every state is drawn open
        here so it can be checked at 390, 820 and 1440 px; on the site the panel opens when the box
        is focused. Suggestions come from Ola Maps through our own server, so its credit and the
        OpenStreetMap licence always show at the bottom. The wording is for approval.
      </Text>
      {STATES.map((spec) => (
        <Specimen key={spec.label} label={spec.label}>
          <PanelCard spec={spec} />
        </Specimen>
      ))}
      <Specimen label="A place chosen: the box holds the name and the panel is closed">
        <PickedCard />
      </Specimen>
    </div>
  );
}
