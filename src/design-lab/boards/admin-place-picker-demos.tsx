"use client";

import { useState } from "react";
import type { PlacePanelState } from "@/components/domain/place-panel";
import {
  PlacePicker,
  pickedCoordinates,
  type PlacePickerFieldProps,
} from "@/components/domain/place-picker";
import {
  SiteLocalitiesEditor,
  type SiteLocalitiesWords,
  type SiteLocalityRow,
} from "@/components/domain/site-localities-editor";
import type { ComboboxOption } from "@/components/patterns/combobox";
import { FormField } from "@/components/patterns/form-field";
import { FormSection } from "@/components/patterns/form-section";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/** Sample suggestions as the place lookup would give them (real Chennai areas; the points are made up). */
const PLACES = [
  {
    id: "velachery",
    label: "Velachery",
    detail: "Chennai, Tamil Nadu",
    lat: 12.9815,
    lng: 80.2209,
  },
  {
    id: "velachery-main-road",
    label: "Velachery Main Road",
    detail: "Velachery, Chennai",
    lat: 12.9792,
    lng: 80.2189,
  },
  {
    id: "velachery-mrts",
    label: "Velachery MRTS Station",
    detail: "Velachery, Chennai",
    lat: 12.9831,
    lng: 80.2184,
  },
];

const OPTIONS: ComboboxOption[] = PLACES.map((place) => ({
  value: place.id,
  label: place.label,
  description: place.detail,
}));

/**
 * The picker the Design Lab gives the forms: the same box and panel as the site's, with a short fixed list in place
 * of our place route, so no picture calls the network. Three letters of "Velachery" show suggestions; other text
 * shows "no places found".
 */
export function LabPlacePicker({ id, suffix, disabled, onPick }: PlacePickerFieldProps) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const typed = text.trim().toLowerCase();
  const settled = picked !== null && picked === text.trim();
  const matches =
    typed.length >= 3 ? OPTIONS.filter((option) => option.label.toLowerCase().includes(typed)) : [];
  const state: PlacePanelState =
    typed.length >= 3 && matches.length === 0 && !settled ? "empty" : "ready";
  return (
    <PlacePicker
      id={id}
      {...(suffix === undefined ? {} : { suffix })}
      {...(disabled === undefined ? {} : { disabled })}
      value={text}
      onValueChange={setText}
      onQueryChange={() => undefined}
      options={settled ? [] : matches}
      state={state}
      pickedLabel={picked}
      onSelect={(option) => {
        const place = PLACES.find((one) => one.id === option.value);
        if (!place) return;
        setPicked(place.label);
        onPick({ label: place.label, lat: place.lat, lng: place.lng });
      }}
    />
  );
}

type StateSpec = {
  label: string;
  text: string;
  state: PlacePanelState;
  options: ComboboxOption[];
  picked?: string;
  open?: boolean;
};

const STATES: StateSpec[] = [
  { label: "Empty: the box before anything is typed", text: "", state: "ready", options: [] },
  {
    label: "Typing: fewer than three characters, the note under the box",
    text: "Ve",
    state: "ready",
    options: [],
    open: true,
  },
  {
    label: "Results open: the same rows as the search box, with the Ola Maps credit",
    text: "Vel",
    state: "ready",
    options: OPTIONS,
    open: true,
  },
  {
    label:
      "Picked: the box holds the name, the panel is closed and a line says the boxes were filled",
    text: "Velachery",
    state: "ready",
    options: [],
    picked: "Velachery",
  },
  {
    label: "Unavailable: the panel says so and to type the numbers instead (no keyword row)",
    text: "Velachery",
    state: "unavailable",
    options: [],
    open: true,
  },
];

function StateBox({ spec, id }: { spec: StateSpec; id: string }) {
  const [text, setText] = useState(spec.text);
  return (
    <div className={spec.open ? "h-120 w-full max-w-205" : "w-full max-w-205"}>
      <PlacePicker
        id={id}
        value={text}
        onValueChange={setText}
        onQueryChange={() => undefined}
        options={spec.options}
        state={spec.state}
        pickedLabel={spec.picked ?? null}
        onSelect={() => undefined}
        defaultOpen={spec.open === true}
      />
    </div>
  );
}

const ROWS: SiteLocalityRow[] = [
  { id: "row-1", label: "Adyar", lat: "13.0067", lng: "80.2573", radiusKm: "3" },
  { id: "row-2", label: "", lat: "", lng: "", radiusKm: "3" },
];

const LOCALITIES_WORDS: SiteLocalitiesWords = {
  title: "Explore by locality",
  description: "Tiles shown under the search.",
  add: "Add locality",
  limitTitle: "You've reached the limit",
  limitText: "Remove one to add another.",
  emptyTitle: "No localities yet",
  emptyText: "The section is hidden until you add one.",
  orderHint: "Order matters.",
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

function InLocalityRow() {
  const [localities, setLocalities] = useState(ROWS);
  return (
    <div className="w-full max-w-205">
      <SiteLocalitiesEditor
        localities={localities}
        onChange={setLocalities}
        max={8}
        radii={[2, 3, 4, 5, 6]}
        defaultRadius={3}
        placePicker={LabPlacePicker}
        words={LOCALITIES_WORDS}
      />
    </div>
  );
}

function InProjectLocation() {
  const [point, setPoint] = useState({ lat: "", lng: "" });
  return (
    <div className="w-full max-w-205">
      <FormSection
        id="lab-location"
        title="Location"
        description="Where the project is and what is nearby."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <LabPlacePicker
              id="lab-project-place"
              onPick={(pick) => setPoint(pickedCoordinates(pick))}
            />
          </div>
          <FormField label="Latitude" optionalLabel="(optional)">
            <Input
              value={point.lat}
              inputMode="decimal"
              autoComplete="off"
              onChange={(event) => setPoint((now) => ({ ...now, lat: event.target.value }))}
            />
          </FormField>
          <FormField label="Longitude" optionalLabel="(optional)">
            <Input
              value={point.lng}
              inputMode="decimal"
              autoComplete="off"
              onChange={(event) => setPoint((now) => ({ ...now, lng: event.target.value }))}
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  );
}

export function PlacePickerDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The place search box of the admin and builder forms (ADR-140). Choosing a place fills the
        latitude and longitude boxes; the boxes stay editable and stay the source of truth. It is
        the search box&apos;s panel (ADR-131) with its credit, three characters and a 300 ms pause.
        In the Lab a short fixed list stands in for the place route. The locality row is the
        approved screen (ADD-11); the project form&apos;s picker is new, for approval. The words are
        for approval.
      </Text>
      {STATES.map((spec, index) => (
        <Specimen key={spec.label} label={spec.label}>
          <StateBox spec={spec} id={`lab-picker-state-${index + 1}`} />
        </Specimen>
      ))}
      <Specimen label="In a locality row: type Vel and choose a place; the empty row gets its name too, a name already typed stays">
        <InLocalityRow />
      </Specimen>
      <Specimen label="In the project form's Location section: the two boxes fill, then can be edited by hand (new, for approval)">
        <InProjectLocation />
      </Specimen>
    </div>
  );
}
