"use client";

import { useState } from "react";
import { LocationField, type LocationFound } from "@/components/domain/location-field";
import { LocationPrompt } from "@/components/domain/location-prompt";
import { usePlacePanel, type PlacePanelState } from "@/components/domain/place-panel";
import { Combobox, type ComboboxOption } from "@/components/patterns/combobox";
import { FormField } from "@/components/patterns/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

const AREAS = ["Adyar", "Anna Nagar", "Perungudi", "Velachery", "Vyasarpadi"];

const SUGGESTIONS: ComboboxOption[] = [
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
];

/** The place search box as the form holds it. Also drawn by the wizard's address step (seller-parts.tsx). */
export function AddressBox({
  text,
  state = "ready",
  open = false,
  options = [],
}: {
  text: string;
  state?: PlacePanelState;
  open?: boolean;
  options?: ComboboxOption[];
}) {
  const [value, setValue] = useState(text);
  const panel = usePlacePanel(state, value);
  return (
    <Combobox
      aria-label="Address"
      placeholder="Search the address"
      value={value}
      onValueChange={setValue}
      onQueryChange={() => undefined}
      onSelect={() => undefined}
      options={options}
      {...panel}
      defaultOpen={open}
    />
  );
}

/** The area chooser used when no suggestion fits, or when suggestions cannot be fetched. */
function AreaChooser({ chosen }: { chosen?: string }) {
  return (
    <FormField label="Area">
      <NativeSelect defaultValue={chosen ?? ""}>
        <option value="">Choose the area</option>
        {AREAS.map((area) => (
          <option key={area} value={area}>
            {area}
          </option>
        ))}
      </NativeSelect>
    </FormField>
  );
}

const FRAME = "w-full max-w-xl";

const FOUND: LocationFound = {
  label: "Velachery",
  detail: "Chennai, Tamil Nadu · 600042",
  approximate: false,
};

export function LocationFieldDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The address step of the post form with place suggestions and no map (ADR-131, owner decision
        of 17 Nov 2026). The owner picks a suggestion; if none fits, they choose the area and the
        middle of the area is used. A location is needed to continue. The wording is for approval,
        including the line about what visitors see (the public point is rounded to about 100
        metres).
      </Text>
      <Specimen label="Search: a place suggestion list open under the box">
        <div className={`h-110 ${FRAME}`}>
          <LocationField mode="search" box={<AddressBox text="Vel" open options={SUGGESTIONS} />} />
        </div>
      </Specimen>
      <Specimen label="Search: empty box">
        <div className={FRAME}>
          <LocationField mode="search" box={<AddressBox text="" />} />
        </div>
      </Specimen>
      <Specimen label="Found: the owner picked a suggestion">
        <div className={FRAME}>
          <LocationField mode="found" found={FOUND} />
        </div>
      </Specimen>
      <Specimen label="Area: no suggestion fitted, so the area is chosen">
        <div className={FRAME}>
          <LocationField mode="area" box={<AreaChooser />} />
        </div>
      </Specimen>
      <Specimen label="Found: an area chosen, so the location is approximate">
        <div className={FRAME}>
          <LocationField
            mode="found"
            found={{ label: "Velachery", detail: "Chennai, Tamil Nadu", approximate: true }}
          />
        </div>
      </Specimen>
      <Specimen label="Suggestions unavailable: the area is asked for instead, so posting never stops">
        <div className={FRAME}>
          <LocationField mode="area" unavailable box={<AreaChooser />} />
        </div>
      </Specimen>
      <Specimen label="Continue pressed with no location">
        <div className={FRAME}>
          <LocationField mode="search" showError box={<AddressBox text="" />} />
        </div>
      </Specimen>
      <Specimen label="My listings: the note for listings that have no location yet">
        <div className="flex w-full max-w-2xl flex-col gap-4">
          <LocationPrompt count={1} href="#edit-listing" />
          <LocationPrompt count={3} href="#edit-listing" />
          <LocationPrompt count={2} href="#edit-listing" sendsBackToReview />
        </div>
      </Specimen>
    </div>
  );
}
