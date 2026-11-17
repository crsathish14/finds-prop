"use client";

/**
 * PlacePicker: a place search box that fills the latitude and longitude boxes of an admin form (ADR-140).
 * Purpose: the admin and a builder no longer have to look up coordinates and type them: they search for an area
 *   and choose it, and the host writes the point into its two boxes. The boxes stay editable and stay the source of
 *   truth; the picker only writes into them. Owner: design system. It fetches nothing and keeps no suggestions: the
 *   host (a feature's client island) asks our place route and gives this the answer, as the search card's host does.
 * Props: value and onValueChange (the text in the box), onQueryChange (after three characters and a 300 ms pause:
 *   the host asks for suggestions here), options (place rows: { value, label, description }), state (the panel's
 *   state: "ready", "loading", "empty", "unavailable" or "limited", as usePlacePanel takes it), onSelect (the option
 *   chosen), pickedLabel (the name of the place chosen last: while the box still holds it, the panel stays closed and
 *   a line says the boxes were filled from it), suffix (a row's number, added to the box's accessible name: "Find a
 *   place 2"), id, disabled, defaultOpen (the Design Lab and tests only), className. PlacePickerFieldProps is what a
 *   form passes to the picker it was given ({ id, suffix, disabled, onPick }, with onPick called with { label, lat,
 *   lng }) and PlacePickerComponent its type; formatCoordinate and pickedCoordinates turn a point into the text the
 *   boxes hold (at most six decimals, no trailing zeros).
 * Responsive: as wide as its column; the panel is at least 480 px wide where the screen allows (see Combobox).
 * Accessibility: a visible label tied to the box, whose accessible name starts with it; the box is a combobox (arrow
 *   keys move, Enter picks, Escape closes) and Enter never submits the form around it; notes are read politely; the
 *   hint says the boxes can still be edited by hand; the "filled in" line is a status.
 * States: empty, typing (fewer than three characters), loading, results, no places found, unavailable (the panel says
 *   so and to type the numbers instead), too many searches, picked, disabled.
 * Dependencies: Combobox, FormField, usePlacePanel, next-intl. Tests: place-picker.test.tsx; the island
 *   admin-place-picker.test.tsx and the host forms' tests; Design Lab "Admin" (Place picker).
 * UX reference: UX addendum ADD-11 (admin-localities: the Place box of a row) and ADD-07 (place-suggest: the panel).
 *   The project form's picker has no approved screen yet: it is drawn from the same parts, for approval.
 */
import { MapPin, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ComponentType, KeyboardEvent } from "react";
import { usePlacePanel, type PlacePanelState } from "@/components/domain/place-panel";
import { Combobox, type ComboboxOption } from "@/components/patterns/combobox";
import { FormField } from "@/components/patterns/form-field";
import type { Translate } from "@/lib/format";
import { cn } from "@/lib/cn";

/** What a chosen suggestion gives a form: the name of the place and its point. */
type PlacePick = { label: string; lat: number; lng: number };

/** What a form passes to the picker it was given. */
type PlacePickerFieldProps = {
  id: string;
  /** A row's number, so each row's box has its own accessible name. */
  suffix?: string;
  disabled?: boolean;
  onPick: (pick: PlacePick) => void;
};

type PlacePickerComponent = ComponentType<PlacePickerFieldProps>;

type PlacePickerProps = {
  id?: string;
  suffix?: string;
  value: string;
  onValueChange: (value: string) => void;
  onQueryChange: (query: string) => void;
  options: ComboboxOption[];
  state: PlacePanelState;
  onSelect: (option: ComboboxOption) => void;
  pickedLabel?: string | null;
  disabled?: boolean;
  defaultOpen?: boolean;
  className?: string;
};

/** More letters than any name has: a box that holds the place already chosen opens no panel. */
const NEVER = 1000;

/** A point as the boxes hold it: rounded to six decimals (about ten centimetres), no trailing zeros. */
function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(6))) : "";
}

function pickedCoordinates(pick: PlacePick): { lat: string; lng: string } {
  return { lat: formatCoordinate(pick.lat), lng: formatCoordinate(pick.lng) };
}

function PlacePicker({
  id,
  suffix,
  value,
  onValueChange,
  onQueryChange,
  options,
  state,
  onSelect,
  pickedLabel = null,
  disabled = false,
  defaultOpen = false,
  className,
}: PlacePickerProps) {
  const translate = useTranslations() as unknown as Translate;
  const panel = usePlacePanel(state, value);
  const label = translate("domain.placePicker.label");
  // The box holds the place that was chosen: nothing to suggest until the text is edited.
  const settled = pickedLabel !== null && value.trim() === pickedLabel;
  // A keyword search means nothing here (there is no search to send it to), so the keyword row is left out, and the
  // unavailable note points at the boxes below instead of at a Search button.
  const { labels, footer, loadingRows } = panel;
  const notices =
    state === "unavailable"
      ? [
          {
            icon: TriangleAlert,
            title: translate("domain.places.unavailable.title"),
            body: translate("domain.placePicker.unavailableBody"),
          },
        ]
      : panel.notices;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Enter picks a row (cmdk) or does nothing; it must never save the form around the box.
    if (event.key === "Enter") event.preventDefault();
  }

  return (
    <div data-slot="place-picker" className={cn("min-w-0", className)} onKeyDown={onKeyDown}>
      <FormField
        label={label}
        hint={
          settled
            ? translate("domain.placePicker.picked", { place: pickedLabel })
            : translate("domain.placePicker.hint")
        }
        {...(id === undefined ? {} : { id })}
      >
        <Combobox
          aria-label={suffix === undefined ? label : `${label} ${suffix}`}
          placeholder={translate("domain.placePicker.placeholder")}
          icon={MapPin}
          value={value}
          onValueChange={onValueChange}
          onQueryChange={onQueryChange}
          onSelect={onSelect}
          options={options}
          loading={state === "loading"}
          disabled={disabled}
          defaultOpen={defaultOpen}
          minChars={settled ? NEVER : 3}
          labels={labels}
          footer={footer}
          loadingRows={loadingRows}
          notices={notices}
          idleNotices={settled ? [] : panel.idleNotices}
        />
      </FormField>
    </div>
  );
}

export { formatCoordinate, PlacePicker, pickedCoordinates };
export type { PlacePick, PlacePickerComponent, PlacePickerFieldProps, PlacePickerProps };
