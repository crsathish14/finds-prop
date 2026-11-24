"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { usePlacePanel, type PlacePanelState } from "@/components/domain/place-panel";
import { Combobox, type ComboboxOption } from "@/components/patterns/combobox";
import { Label } from "@/components/ui/label";
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
];

/** The Locality box of the results filters, as wide as the filter rail. */
function PlaceField({
  id,
  query,
  options,
  loading = false,
  panel,
  open = false,
}: {
  id: string;
  query: string;
  options: ComboboxOption[];
  loading?: boolean;
  panel: ReturnType<typeof usePlacePanel>;
  open?: boolean;
}) {
  const [text, setText] = useState(query);
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      <Label htmlFor={id}>Locality</Label>
      <Combobox
        id={id}
        aria-label="Locality"
        placeholder="Search a locality"
        icon={MapPin}
        value={text}
        onValueChange={setText}
        onQueryChange={() => undefined}
        onSelect={(option) => setText(option.label)}
        options={options}
        loading={loading}
        minChars={3}
        {...panel}
        {...(open ? { defaultOpen: true } : {})}
      />
    </div>
  );
}

/** One box with its place panel open in a given state. Space under it keeps the panel off the next specimen. */
function PanelCard({ spec, id }: { spec: StateSpec; id: string }) {
  const panel = usePlacePanel(spec.state, spec.query);
  return (
    <div className="h-120 w-full">
      <PlaceField
        id={id}
        query={spec.query}
        options={spec.options}
        loading={spec.loading ?? false}
        panel={panel}
        open
      />
    </div>
  );
}

function PickedCard() {
  const panel = usePlacePanel("ready", "Velachery, Chennai");
  return <PlaceField id="lab-place-picked" query="Velachery, Chennai" options={[]} panel={panel} />;
}

export function PlaceSuggestionsDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The place panel of the Locality box in the results filters (ADR-131, UX addendum ADD-07).
        Every state is drawn open here so it can be checked at 390, 820 and 1440 px; on the site the
        panel opens when the box is focused. Suggestions come from Ola Maps through our own server;
        the panel carries no provider credit. The wording is for approval.
      </Text>
      {STATES.map((spec, index) => (
        <Specimen key={spec.label} label={spec.label}>
          <PanelCard spec={spec} id={`lab-place-${index}`} />
        </Specimen>
      ))}
      <Specimen label="A place chosen: the box holds the name and the panel is closed">
        <PickedCard />
      </Specimen>
    </div>
  );
}
