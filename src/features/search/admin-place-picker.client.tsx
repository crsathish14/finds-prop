"use client";

import { useState } from "react";
import { PlacePicker, type PlacePickerFieldProps } from "@/components/domain/place-picker";
import { cityFromPlaceDetail } from "@/lib/place-city";
import { usePlaceSuggestions } from "./use-place-suggestions.client";

/**
 * The place picker of the admin and builder forms (ADR-140): the same suggestions, panel and credit as the search
 * box, asked as `source=admin_picker` so the usage count (ADR-134) tells them apart. It holds only the text in the
 * box; a chosen suggestion goes up through `onPick` as a name and a point, and the form writes the point into its
 * own latitude and longitude boxes, which stay editable and stay the source of truth. When suggestions are
 * unavailable the box says so and the typed numbers still work (FR-GEO-01, criterion 3). A page gives this to a
 * form as a prop, because a form (another feature) cannot import this feature's index in a client file.
 */
export function AdminPlacePicker({ id, suffix, disabled, onPick }: PlacePickerFieldProps) {
  const [text, setText] = useState("");
  const places = usePlaceSuggestions(text, "admin_picker");
  return (
    <PlacePicker
      id={id}
      {...(suffix === undefined ? {} : { suffix })}
      {...(disabled === undefined ? {} : { disabled })}
      value={text}
      onValueChange={setText}
      onQueryChange={places.search}
      options={places.options}
      state={places.state}
      pickedLabel={places.picked?.label ?? null}
      onSelect={(option) => {
        const choice = places.pick(option);
        if (choice === null) return;
        const city = cityFromPlaceDetail(choice.detail);
        onPick({
          label: choice.label,
          lat: choice.lat,
          lng: choice.lng,
          ...(city === null ? {} : { city }),
        });
      }}
    />
  );
}
