// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import type { PlacePickerFieldProps } from "../place-picker";
import {
  SiteHomepageFields,
  type SiteHomepageFieldsWords,
  type SiteHomepageValues,
} from "../site-homepage-fields";
import {
  SiteLocalitiesEditor,
  type SiteLocalitiesWords,
  type SiteLocalityRow,
} from "../site-localities-editor";

const WORDS: SiteLocalitiesWords = {
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

const HOMEPAGE_WORDS: SiteHomepageFieldsWords = {
  sections: {
    title: "Sections",
    description: "Turn sections on or off.",
    featured: { label: "Featured listings", hint: "Up to six." },
    projectTypes: { label: "Project types", hint: "Entry points." },
    discovery: { label: "Explore by locality", hint: "The tiles." },
    whyUs: { label: "Why Find Prop", hint: "Three points." },
    cta: { label: "Call to action", hint: "The banner." },
  },
  localities: WORDS,
};

const RADII = [2, 3, 4, 5, 6];

/** A stand-in for the page's place picker: one button that reports a fixed place, so no network is involved. */
function FakePicker({ id, suffix, disabled, onPick }: PlacePickerFieldProps) {
  return (
    <span id={id}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick({ label: "KK Nagar", lat: 13.04181234, lng: 80.2341 })}
      >
        {`Pick place ${suffix ?? ""}`.trim()}
      </button>
    </span>
  );
}

const rows = (...list: Array<Partial<SiteLocalityRow> & { id: string }>): SiteLocalityRow[] =>
  list.map((row) => ({ label: "", lat: "13.0", lng: "80.2", radiusKm: "3", ...row }));

function Live({
  initial,
  disabled = false,
  picker = FakePicker,
}: {
  initial: SiteLocalityRow[];
  disabled?: boolean;
  picker?: (props: PlacePickerFieldProps) => React.JSX.Element;
}) {
  const [localities, setLocalities] = useState(initial);
  return (
    <SiteLocalitiesEditor
      localities={localities}
      onChange={setLocalities}
      max={8}
      radii={RADII}
      defaultRadius={3}
      placePicker={picker}
      disabled={disabled}
      words={WORDS}
    />
  );
}

describe("UT-site-localities-editor with a place picker (ADR-140)", () => {
  it("draws one picker in each row, numbered, and none when the page gives no picker", () => {
    const initial = rows({ id: "a", label: "Adyar" }, { id: "b", label: "Velachery" });
    const { rerender } = render(<Live initial={initial} />);
    expect(screen.getAllByRole("button", { name: /^Pick place / })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Pick place 2" })).toBeInTheDocument();
    rerender(
      <SiteLocalitiesEditor
        localities={initial}
        onChange={() => undefined}
        max={4}
        radii={RADII}
        defaultRadius={3}
        words={WORDS}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Pick place / })).toBeNull();
  });

  it("writes the point into the two boxes of that row only, with at most six decimals", async () => {
    render(<Live initial={rows({ id: "a", label: "Adyar" }, { id: "b", label: "Velachery" })} />);
    await userEvent.click(screen.getByRole("button", { name: "Pick place 2" }));
    expect(screen.getByRole("textbox", { name: "Latitude 2" })).toHaveValue("13.041812");
    expect(screen.getByRole("textbox", { name: "Longitude 2" })).toHaveValue("80.2341");
    expect(screen.getByRole("textbox", { name: "Latitude 1" })).toHaveValue("13.0");
    expect(screen.getByRole("textbox", { name: "Longitude 1" })).toHaveValue("80.2");
  });

  it("offers the name only while the label is empty, and never overwrites a name that was typed", async () => {
    render(
      <Live
        initial={rows(
          { id: "a", label: "Adyar" },
          { id: "b", label: "   " },
          { id: "c", label: "" },
        )}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Pick place 1" }));
    expect(screen.getByRole("textbox", { name: "Label 1" })).toHaveValue("Adyar");
    expect(screen.getByRole("textbox", { name: "Latitude 1" })).toHaveValue("13.041812");
    await userEvent.click(screen.getByRole("button", { name: "Pick place 2" }));
    expect(screen.getByRole("textbox", { name: "Label 2" })).toHaveValue("KK Nagar");
    await userEvent.click(screen.getByRole("button", { name: "Pick place 3" }));
    expect(screen.getByRole("textbox", { name: "Label 3" })).toHaveValue("KK Nagar");
  });

  it("cuts a long name to the label's limit", async () => {
    const Long = ({ onPick }: PlacePickerFieldProps) => (
      <button type="button" onClick={() => onPick({ label: "K".repeat(90), lat: 13, lng: 80 })}>
        pick long
      </button>
    );
    render(<Live initial={rows({ id: "a" })} picker={Long} />);
    await userEvent.click(screen.getByRole("button", { name: "pick long" }));
    expect(screen.getByRole("textbox", { name: "Label 1" })).toHaveValue("K".repeat(60));
    expect(screen.getByRole("textbox", { name: "Latitude 1" })).toHaveValue("13");
  });

  it("leaves the boxes editable after a pick, and the radius and other rows alone", async () => {
    render(
      <Live
        initial={rows({ id: "a", radiusKm: "5" }, { id: "b", lat: "1", lng: "2", label: "Porur" })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Pick place 1" }));
    const latitude = screen.getByRole("textbox", { name: "Latitude 1" });
    await userEvent.clear(latitude);
    await userEvent.type(latitude, "13.5");
    expect(latitude).toHaveValue("13.5");
    expect(screen.getByRole("combobox", { name: "Radius 1" })).toHaveValue("5");
    expect(screen.getByRole("textbox", { name: "Latitude 2" })).toHaveValue("1");
  });

  it("switches the picker off while saving", () => {
    render(<Live initial={rows({ id: "a", label: "Adyar" })} disabled />);
    expect(screen.getByRole("button", { name: "Pick place 1" })).toBeDisabled();
  });

  it("is passed through the Homepage fields", async () => {
    const Page = () => {
      const [values, setValues] = useState<SiteHomepageValues>({
        showFeatured: true,
        showProjectTypes: true,
        showDiscovery: true,
        showWhyUs: true,
        showCta: true,
        localities: rows({ id: "a", label: "Adyar" }),
      });
      return (
        <SiteHomepageFields
          values={values}
          onChange={setValues}
          localitiesMax={8}
          radii={RADII}
          defaultRadius={3}
          placePicker={FakePicker}
          words={HOMEPAGE_WORDS}
        />
      );
    };
    render(<Page />);
    await userEvent.click(screen.getByRole("button", { name: "Pick place 1" }));
    expect(screen.getByRole("textbox", { name: "Longitude 1" })).toHaveValue("80.2341");
  });
});
