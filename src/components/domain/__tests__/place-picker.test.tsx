// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ComboboxOption } from "@/components/patterns/combobox";
import {
  formatCoordinate,
  PlacePicker,
  pickedCoordinates,
  type PlacePickerProps,
} from "../place-picker";
import type { PlacePanelState } from "../place-panel";

const words = en.domain.placePicker;
const places = en.domain.places;

const OPTIONS: ComboboxOption[] = [
  { value: "p1", label: "Velachery", description: "Chennai, Tamil Nadu" },
  { value: "p2", label: "Velachery Main Road", description: "Velachery, Chennai" },
];

function Harness({
  initial = "",
  state = "ready",
  options = [],
  ...rest
}: {
  initial?: string;
  state?: PlacePanelState;
  options?: ComboboxOption[];
} & Partial<PlacePickerProps>) {
  const [text, setText] = useState(initial);
  return (
    <PlacePicker
      value={text}
      onValueChange={setText}
      onQueryChange={() => undefined}
      options={options}
      state={state}
      onSelect={() => undefined}
      {...rest}
    />
  );
}

describe("formatCoordinate and pickedCoordinates (ADR-140)", () => {
  it("shows at most six decimals and no trailing zeros, as the boxes show a saved number", () => {
    expect(formatCoordinate(13.0418)).toBe("13.0418");
    expect(formatCoordinate(12.98154321)).toBe("12.981543");
    expect(formatCoordinate(80.2)).toBe("80.2");
    expect(formatCoordinate(80)).toBe("80");
    expect(formatCoordinate(12.9999996)).toBe("13");
    expect(formatCoordinate(Number.NaN)).toBe("");
    expect(pickedCoordinates({ label: "KK Nagar", lat: 13.041812345, lng: 80.2341 })).toEqual({
      lat: "13.041812",
      lng: "80.2341",
    });
  });
});

describe("UT-place-picker: the place search box of the admin forms (ADR-140)", () => {
  it("has a visible label and the hint that the boxes can still be edited", () => {
    renderWithMessages(<Harness id="place" />);
    const box = screen.getByRole("combobox", { name: words.label });
    expect(box).toHaveAttribute("id", "place");
    expect(screen.getAllByText(words.label).length).toBeGreaterThan(0);
    expect(screen.getByText(words.hint)).toBeInTheDocument();
    expect(box).toHaveAttribute("placeholder", words.placeholder);
  });

  it("names each row's box with its number, the visible label first", () => {
    renderWithMessages(<Harness suffix="2" />);
    expect(screen.getByRole("combobox", { name: `${words.label} 2` })).toBeInTheDocument();
  });

  it("says what to type under three characters, and that the area is Tamil Nadu only", async () => {
    renderWithMessages(<Harness />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(
      (await screen.findAllByText(places.idle.title.replace("{count}", "3")))[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText(places.region).length).toBeGreaterThan(0);
  });

  it("lists the suggestions with the Ola Maps credit, and a click reports the option chosen", async () => {
    const onSelect = vi.fn();
    renderWithMessages(<Harness initial="Vel" options={OPTIONS} onSelect={onSelect} defaultOpen />);
    expect((await screen.findAllByText(places.attribution.poweredBy))[0]).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("option", { name: /Velachery Main Road/ }));
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1]);
    // The box then holds the name.
    expect(screen.getByRole("combobox")).toHaveValue("Velachery Main Road");
  });

  it("is used from the keyboard: arrows move, Enter picks, and Enter never submits the form around it", async () => {
    const onSelect = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    renderWithMessages(
      <form onSubmit={onSubmit}>
        <Harness initial="Vel" options={OPTIONS} onSelect={onSelect} defaultOpen />
      </form>,
    );
    await userEvent.click(screen.getByRole("combobox"));
    await screen.findByRole("option", { name: /Velachery Main Road/ });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1]);
    expect(onSubmit).not.toHaveBeenCalled();
    // Enter with nothing to pick (the panel is closed now) saves nothing either.
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not offer the keyword row: there is no search to send the text to", async () => {
    renderWithMessages(<Harness initial="Velxy" state="empty" defaultOpen />);
    expect((await screen.findAllByText(places.empty.body))[0]).toBeInTheDocument();
    expect(screen.queryByText(/as a keyword/)).not.toBeInTheDocument();
  });

  it("when suggestions are unavailable says so and points at the boxes, with no Search button talk", async () => {
    renderWithMessages(<Harness initial="Velachery" state="unavailable" defaultOpen />);
    expect((await screen.findAllByText(places.unavailable.title))[0]).toBeInTheDocument();
    expect(screen.getAllByText(words.unavailableBody).length).toBeGreaterThan(0);
    expect(screen.queryByText(places.unavailable.body)).not.toBeInTheDocument();
    expect(screen.queryByText(/as a keyword/)).not.toBeInTheDocument();
    // The box itself still takes text.
    await userEvent.type(screen.getByRole("combobox"), " Road");
    expect(screen.getByRole("combobox")).toHaveValue("Velachery Road");
  });

  it("says too many searches with the panel's own note", async () => {
    renderWithMessages(<Harness initial="Vel" state="limited" defaultOpen />);
    expect((await screen.findAllByText(places.limited.title))[0]).toBeInTheDocument();
  });

  it("while the box holds the place already chosen, opens no panel and says the boxes were filled", async () => {
    renderWithMessages(<Harness initial="Velachery" pickedLabel="Velachery" />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByText(places.attribution.poweredBy)).not.toBeInTheDocument();
    expect(screen.queryByText(places.idle.title.replace("{count}", "3"))).not.toBeInTheDocument();
    expect(screen.getByText(words.picked.replace("{place}", "Velachery"))).toBeInTheDocument();
    expect(screen.queryByText(words.hint)).not.toBeInTheDocument();
  });

  it("goes back to the hint and to suggesting once the chosen name is edited", async () => {
    renderWithMessages(<Harness initial="Velachery" pickedLabel="Velachery" />);
    await userEvent.type(screen.getByRole("combobox"), " Road");
    expect(screen.getByText(words.hint)).toBeInTheDocument();
  });

  it("is off while the form saves", () => {
    renderWithMessages(<Harness disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
