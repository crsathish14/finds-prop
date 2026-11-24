"use client";

import { MapPin, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LocationField } from "@/components/domain/location-field";
import {
  usePlacePanel,
  type PlacePanelProps,
  type PlacePanelState,
} from "@/components/domain/place-panel";
import { Combobox, type ComboboxNotice } from "@/components/patterns/combobox";
import { FormField } from "@/components/patterns/form-field";
import { Select } from "@/components/ui/select";
import type { Translate } from "@/lib/format";
import type { ListingLocationFieldProps, PlaceAutocompleteSuggestion } from "@/types/places";
import { usePlaceSuggestions, type PlaceChoice } from "./use-place-suggestions.client";

/** The area chooser asks for an area and nothing finer. A constant, so the hook's request stays the same. */
const AREA_ONLY: readonly PlaceChoice["kind"][] = ["area"];

/** The route always names a kind; a suggestion without one is treated as a place, never as an area. */
function asSuggestion(choice: PlaceChoice, kind?: PlaceAutocompleteSuggestion["kind"]) {
  return { ...choice, kind: kind ?? choice.kind ?? "venue" } satisfies PlaceAutocompleteSuggestion;
}

/**
 * The panel of the place search for a form field. The shared panel's "search as a keyword" row and its line about
 * pressing Search belong to the search boxes: here nothing is searched by keyword, so the row is left out and the
 * "not available" note has no instruction (the field above the box says what to do instead).
 */
function formPanel(
  panel: PlacePanelProps,
  state: PlacePanelState,
  unavailableNote: ComboboxNotice[],
) {
  return {
    labels: panel.labels,
    idleNotices: panel.idleNotices,
    notices: state === "unavailable" ? unavailableNote : panel.notices,
    loadingRows: panel.loadingRows,
  };
}

/**
 * The location field of the post-property address step, connected (place search PR 7b, ADR-141): the place search
 * box (`GET /api/places/autocomplete?q=&source=listing_form`, the approved panel), the
 * "choose the area instead" path (suggestions of kind area only, the middle of the area, approximate), and, when
 * suggestions cannot be fetched, the site's curated localities as a plain list, so posting never stops
 * (FR-GEO-01 criterion 3, FR-GEO-02, OLA_MAPS_PLAN decision D4). It holds only what is being typed and which way
 * the owner is choosing; a chosen place goes up through `onPick` or `onPickArea` and the wizard keeps it. The
 * point is never put in an address, a log line or storage by this file. A page gives this to the wizard as a
 * prop, because the wizard (another feature) cannot import this feature's index in a client file (ADR-140).
 */
export function ListingLocationField({
  held,
  areas,
  errorText,
  disabled,
  onPick,
  onPickArea,
  onChange,
}: ListingLocationFieldProps) {
  const translate = useTranslations() as unknown as Translate;
  const [mode, setMode] = useState<"search" | "area">("search");
  const [text, setText] = useState("");
  const [areaText, setAreaText] = useState("");
  const places = usePlaceSuggestions(text, "listing_form");
  const areaPlaces = usePlaceSuggestions(areaText, "listing_form", AREA_ONLY);
  const searchPanel = usePlacePanel(places.state, text);
  const areaPanel = usePlacePanel(areaPlaces.state, areaText);

  const hasAreas = areas.length > 0;
  // Suggestions cannot be fetched (or we are asked to slow down in the area box): the curated list takes over.
  const searchDown = places.state === "unavailable";
  const areaDown = areaPlaces.state === "unavailable" || areaPlaces.state === "limited";
  const inArea = mode === "area" || (searchDown && hasAreas);
  const useList = inArea && hasAreas && (searchDown || areaDown);
  const unavailable = inArea ? searchDown || areaDown : searchDown;

  const unavailableNote: ComboboxNotice[] = [
    {
      icon: TriangleAlert,
      title: translate("domain.places.unavailable.title"),
    },
  ];

  function startAgain() {
    setMode("search");
    setText("");
    setAreaText("");
    onChange();
  }

  const searchBox = (
    <Combobox
      aria-label={translate("domain.locationField.title")}
      placeholder={translate("domain.placePicker.placeholder")}
      icon={MapPin}
      value={text}
      onValueChange={setText}
      onQueryChange={places.search}
      onSelect={(option) => {
        const choice = places.pick(option);
        if (choice !== null) onPick(asSuggestion(choice));
      }}
      options={places.options}
      loading={places.state === "loading"}
      disabled={disabled}
      {...formPanel(searchPanel, places.state, unavailableNote)}
    />
  );

  const areaBox = useList ? (
    <FormField label={translate("postProperty.location.areaLabel")}>
      <Select
        value=""
        disabled={disabled}
        onChange={(event) => {
          const area = areas[Number(event.target.value)];
          if (area) onPickArea(area);
        }}
      >
        <option value="">{translate("postProperty.location.areaOption")}</option>
        {areas.map((area, index) => (
          <option key={`${area.label}-${index}`} value={String(index)}>
            {area.label}
          </option>
        ))}
      </Select>
    </FormField>
  ) : (
    <Combobox
      aria-label={translate("domain.locationField.areaTitle")}
      placeholder={translate("domain.placePicker.placeholder")}
      icon={MapPin}
      value={areaText}
      onValueChange={setAreaText}
      onQueryChange={areaPlaces.search}
      onSelect={(option) => {
        const choice = areaPlaces.pick(option);
        // Only an area was offered, so the middle of it is what is held, and it shows as approximate.
        if (choice !== null) onPick(asSuggestion(choice, "area"));
      }}
      options={areaPlaces.options}
      loading={areaPlaces.state === "loading"}
      disabled={disabled}
      {...formPanel(areaPanel, areaPlaces.state, unavailableNote)}
    />
  );

  return (
    <LocationField
      mode={held ? "found" : inArea ? "area" : "search"}
      box={inArea ? areaBox : searchBox}
      found={held ?? undefined}
      unavailable={unavailable}
      showError={errorText !== null}
      {...(errorText === null ? {} : { errorText })}
      onChange={startAgain}
      onChooseArea={() => setMode("area")}
      onSearchAddress={() => {
        setMode("search");
        setText("");
        setAreaText("");
      }}
    />
  );
}
