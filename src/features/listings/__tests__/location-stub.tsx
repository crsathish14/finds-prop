import type { ListingLocationFieldProps, PlaceAutocompleteSuggestion } from "@/types/places";

/**
 * Stand-in for the connected location field in the wizard's tests (ADR-141): the real one is the search feature's
 * island and fetches suggestions, which these tests never do. It has one button for each way the real field can
 * report a place, shows what the wizard hands it, and has the same marks the wizard looks for to move focus to a
 * field that is wrong.
 */
export const STREET: PlaceAutocompleteSuggestion = {
  id: "street-1",
  label: "Velachery Main Road",
  detail: "Velachery, Chennai, Tamil Nadu 600042, India",
  kind: "street",
  lat: 12.9815,
  lng: 80.2209,
};

export const AREA: PlaceAutocompleteSuggestion = {
  id: "area-1",
  label: "Adyar",
  detail: "Chennai, Tamil Nadu, India",
  kind: "area",
  lat: 13.0012,
  lng: 80.2565,
};

/** A street whose address says Chennai first, so the city box keeps its starting value in tests that need that. */
export const CHENNAI_STREET: PlaceAutocompleteSuggestion = {
  id: "street-2",
  label: "Second Cross Street",
  detail: "Chennai, Tamil Nadu, India",
  kind: "street",
  lat: 13.05,
  lng: 80.25,
};

export function LocationFieldStub(props: ListingLocationFieldProps) {
  return (
    <div
      data-slot="location-field"
      data-testid="location-stub"
      {...(props.errorText ? { "aria-describedby": "location-stub-error" } : {})}
    >
      <button type="button" disabled={props.disabled} onClick={() => props.onPick(CHENNAI_STREET)}>
        stub pick place
      </button>
      <button type="button" disabled={props.disabled} onClick={() => props.onPick(STREET)}>
        stub pick street
      </button>
      <button type="button" disabled={props.disabled} onClick={() => props.onPick(AREA)}>
        stub pick area suggestion
      </button>
      <button
        type="button"
        disabled={props.disabled}
        onClick={() => {
          const first = props.areas[0];
          if (first) props.onPickArea(first);
        }}
      >
        stub pick curated area
      </button>
      <button type="button" onClick={props.onChange}>
        stub change place
      </button>
      <p data-testid="location-held">
        {props.held
          ? `${props.held.label}|${props.held.approximate ? "approximate" : "exact"}`
          : ""}
      </p>
      <p data-testid="location-areas">{props.areas.map((area) => area.label).join(",")}</p>
      {props.errorText ? (
        <p id="location-stub-error" role="alert">
          {props.errorText}
        </p>
      ) : null}
    </div>
  );
}
