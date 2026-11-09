// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChoiceCards } from "../choice-cards";
import { SiteHeroFields, type SiteHeroFieldsWords, type SiteHeroValues } from "../site-hero-fields";
import { SiteHeroPreview } from "../site-hero-preview";
import {
  SiteHomepageFields,
  type SiteHomepageFieldsWords,
  type SiteHomepageValues,
} from "../site-homepage-fields";
import { SiteHomepagePreview } from "../site-homepage-preview";
import {
  SiteLocalitiesEditor,
  type SiteLocalitiesWords,
  type SiteLocalityRow,
} from "../site-localities-editor";

const HERO_WORDS: SiteHeroFieldsWords = {
  text: { title: "Text" },
  layout: {
    title: "Layout",
    description: "Both layouts use the same text.",
    searchDesk: { label: "Search Desk", hint: "Centred search." },
    split: { label: "Split", hint: "Search on the left." },
  },
  eyebrow: "Eyebrow",
  eyebrowHint: "A small line above the headline.",
  headline: "Headline",
  subtitle: "Subtitle",
  optional: "(optional)",
};

const HERO: SiteHeroValues = {
  eyebrow: "Tamil Nadu",
  title: "Find the place",
  subtitle: "Shortlist and compare.",
  layout: "search_desk",
};

describe("UT-choice-cards-visual: the cards can carry a drawing and a hidden legend (S7-T10)", () => {
  it("shows a drawing above the name, hidden from a screen reader", () => {
    render(
      <ChoiceCards
        legend="Layout"
        name="layout"
        value="a"
        onChange={() => undefined}
        options={[
          { value: "a", label: "Option A", visual: <span data-testid="drawing" /> },
          { value: "b", label: "Option B" },
        ]}
      />,
    );
    expect(screen.getByTestId("drawing").closest("[aria-hidden='true']")).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Option A" })).toBeChecked();
  });

  it("keeps the legend for a screen reader only when asked", () => {
    render(
      <ChoiceCards
        hideLegend
        legend="Layout"
        name="layout"
        value={null}
        onChange={() => undefined}
        options={[{ value: "a", label: "Option A" }]}
      />,
    );
    expect(screen.getByRole("group", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByText("Layout")).toHaveClass("sr-only");
  });
});

describe("UT-site-hero-fields: the Hero page's boxes (S7-T10)", () => {
  const setup = (props: Partial<React.ComponentProps<typeof SiteHeroFields>> = {}) => {
    const onChange = vi.fn();
    render(<SiteHeroFields values={HERO} onChange={onChange} words={HERO_WORDS} {...props} />);
    return onChange;
  };

  it("labels every box and marks the headline as needed and the others as optional", () => {
    setup();
    expect(screen.getByRole("textbox", { name: /Headline/ })).toHaveValue("Find the place");
    expect(screen.getByRole("textbox", { name: /Eyebrow/ })).toHaveValue("Tamil Nadu");
    expect(screen.getByRole("textbox", { name: /Subtitle/ })).toHaveValue("Shortlist and compare.");
    expect(screen.getAllByText("(optional)")).toHaveLength(2);
    expect(screen.getByText("A small line above the headline.")).toBeInTheDocument();
  });

  it("passes up the whole values with only the typed box changed", async () => {
    const onChange = setup();
    await userEvent.type(screen.getByRole("textbox", { name: /Headline/ }), "!");
    expect(onChange).toHaveBeenLastCalledWith({ ...HERO, title: "Find the place!" });
  });

  it("offers the two layouts as one radio group, with the current one chosen", () => {
    setup();
    const group = screen.getByRole("group", { name: "Layout" });
    expect(within(group).getByRole("radio", { name: /Search Desk/ })).toBeChecked();
    expect(within(group).getByRole("radio", { name: /Split/ })).not.toBeChecked();
  });

  it("passes up the chosen layout", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole("radio", { name: /Split/ }));
    expect(onChange).toHaveBeenCalledWith({ ...HERO, layout: "split" });
  });

  it("shows a problem beside its box and ties it to the box", () => {
    setup({ errors: { title: "This field is required." } });
    const box = screen.getByRole("textbox", { name: /Headline/ });
    expect(box).toBeInvalid();
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
  });

  it("turns every box and both layout cards off while saving", () => {
    setup({ disabled: true });
    for (const box of screen.getAllByRole("textbox")) expect(box).toBeDisabled();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });
});

describe("UT-site-hero-preview: the drawing of the hero (S7-T10)", () => {
  it("shows the eyebrow in the Split layout only, as the home page does", () => {
    const { container, rerender } = render(
      <SiteHeroPreview title="Headline" eyebrow="Eyebrow" layout="split" />,
    );
    expect(container.textContent).toContain("Eyebrow");
    rerender(<SiteHeroPreview title="Headline" eyebrow="Eyebrow" layout="search_desk" />);
    expect(container.textContent).not.toContain("Eyebrow");
  });

  it("leaves out an empty subtitle, hides itself from a screen reader and names its layout", () => {
    const { container } = render(<SiteHeroPreview title="Headline" layout="search_desk" />);
    const drawing = container.querySelector("[data-slot='site-hero-preview']");
    expect(drawing).toHaveAttribute("aria-hidden", "true");
    expect(drawing).toHaveAttribute("data-layout", "search_desk");
    expect(drawing?.querySelectorAll("p")).toHaveLength(1);
  });
});

const LOCALITY_WORDS: SiteLocalitiesWords = {
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

const place = (id: string, label: string, radiusKm = "3"): SiteLocalityRow => ({
  id,
  label,
  lat: "13.0",
  lng: "80.2",
  radiusKm,
});
const THREE_PLACES = [place("p1", "Adyar"), place("p2", "Velachery"), place("p3", "Navalur", "6")];
const RADII = [2, 3, 4, 5, 6];

describe("UT-site-localities-editor: the list of localities (S7-T10)", () => {
  const setup = (props: Partial<React.ComponentProps<typeof SiteLocalitiesEditor>> = {}) => {
    const onChange = vi.fn();
    render(
      <SiteLocalitiesEditor
        localities={THREE_PLACES}
        onChange={onChange}
        max={4}
        radii={RADII}
        defaultRadius={3}
        words={LOCALITY_WORDS}
        {...props}
      />,
    );
    return onChange;
  };

  it("names every row by its place and every box by what it holds", () => {
    setup();
    expect(screen.getByRole("group", { name: "Locality 2" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Label 2" })).toHaveValue("Velachery");
    expect(screen.getByRole("textbox", { name: "Latitude 2" })).toHaveValue("13.0");
    expect(screen.getByRole("textbox", { name: "Longitude 2" })).toHaveValue("80.2");
    expect(screen.getByRole("combobox", { name: "Radius 3" })).toHaveValue("6");
  });

  it("changes only the row that was typed in or chosen", async () => {
    const onChange = setup();
    await userEvent.type(screen.getByRole("textbox", { name: "Label 2" }), "!");
    expect(onChange).toHaveBeenLastCalledWith([
      THREE_PLACES[0],
      { ...THREE_PLACES[1], label: "Velachery!" },
      THREE_PLACES[2],
    ]);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Radius 1" }), "5");
    expect(onChange).toHaveBeenLastCalledWith([
      { ...THREE_PLACES[0], radiusKm: "5" },
      THREE_PLACES[1],
      THREE_PLACES[2],
    ]);
  });

  it("offers the distances and keeps a stored one that is not offered", () => {
    setup({ localities: [place("p1", "Adyar", "10")] });
    const options = within(screen.getByRole("combobox", { name: "Radius 1" }))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["2 km", "3 km", "4 km", "5 km", "6 km", "10 km"]);
    expect(screen.getByRole("combobox", { name: "Radius 1" })).toHaveValue("10");
  });

  it("adds an empty row with the default distance and a new id", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole("button", { name: "Add locality" }));
    const next = onChange.mock.calls[0]?.[0] as SiteLocalityRow[];
    expect(next).toHaveLength(4);
    expect(next.slice(0, 3)).toEqual(THREE_PLACES);
    expect(next[3]).toMatchObject({ label: "", lat: "", lng: "", radiusKm: "3" });
    expect(THREE_PLACES.map((one) => one.id)).not.toContain(next[3]?.id);
  });

  it("removes the row whose button was pressed, and says which one", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole("button", { name: "Remove: Velachery" }));
    expect(onChange).toHaveBeenCalledWith([THREE_PLACES[0], THREE_PLACES[2]]);
  });

  it("moves a row up or down with its arrows, and not past either end", async () => {
    const onChange = setup();
    expect(screen.getByRole("button", { name: "Move up: Adyar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move down: Navalur" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Move down: Adyar" }));
    expect(onChange).toHaveBeenCalledWith([THREE_PLACES[1], THREE_PLACES[0], THREE_PLACES[2]]);
  });

  it("turns Add off at the limit and says why", () => {
    setup({ max: 3 });
    expect(screen.getByRole("button", { name: "Add locality" })).toBeDisabled();
    expect(screen.getByText("You've reached the limit")).toBeInTheDocument();
  });

  it("shows the note and an Add button when the list is empty", () => {
    setup({ localities: [] });
    expect(screen.getByRole("status")).toHaveTextContent("No localities yet");
    expect(screen.getAllByRole("button", { name: "Add locality" })).toHaveLength(1);
    expect(screen.queryByText("Order matters.")).not.toBeInTheDocument();
  });

  it("shows each problem beside its own box", () => {
    setup({ errors: { p2: { lat: "Outside the area.", label: "Needs a name." } } });
    expect(screen.getByRole("textbox", { name: "Latitude 2" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Label 2" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Longitude 2" })).toBeValid();
    expect(screen.getByRole("textbox", { name: "Latitude 1" })).toBeValid();
  });

  it("turns every box and button off while saving", () => {
    setup({ disabled: true });
    for (const box of screen.getAllByRole("textbox")) expect(box).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add locality" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove: Adyar" })).toBeDisabled();
  });
});

const HOMEPAGE_WORDS: SiteHomepageFieldsWords = {
  sections: {
    title: "Sections",
    description: "Turn sections on or off.",
    featured: { label: "Featured listings", hint: "Up to six featured homes." },
    projectTypes: { label: "Browse by what matters", hint: "Entry points." },
    discovery: { label: "Explore by locality", hint: "Needs a locality." },
    whyUs: { label: "Why Find Prop", hint: "Three points." },
    cta: { label: "Call to action", hint: "The closing banner." },
  },
  localities: LOCALITY_WORDS,
};

const HOMEPAGE: SiteHomepageValues = {
  showFeatured: true,
  showProjectTypes: true,
  showDiscovery: true,
  showWhyUs: false,
  showCta: true,
  localities: THREE_PLACES,
};

describe("UT-site-homepage-fields: the Homepage page's boxes (S7-T10)", () => {
  const setup = (props: Partial<React.ComponentProps<typeof SiteHomepageFields>> = {}) => {
    const onChange = vi.fn();
    render(
      <SiteHomepageFields
        values={HOMEPAGE}
        onChange={onChange}
        localitiesMax={8}
        radii={RADII}
        defaultRadius={3}
        words={HOMEPAGE_WORDS}
        {...props}
      />,
    );
    return onChange;
  };

  it("shows one switch for each section, set as the values say, with its line read with it", () => {
    setup();
    expect(screen.getAllByRole("switch")).toHaveLength(5);
    expect(screen.getByRole("switch", { name: /Featured listings/ })).toBeChecked();
    expect(screen.getByRole("switch", { name: /Why Find Prop/ })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: /Why Find Prop/ })).toHaveAccessibleDescription(
      "Three points.",
    );
  });

  it("flips only the switch that was pressed, keeping the localities", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole("switch", { name: /Why Find Prop/ }));
    expect(onChange).toHaveBeenCalledWith({ ...HOMEPAGE, showWhyUs: true });
  });

  it("makes the whole label row the click target of its switch", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByText("Up to six featured homes."));
    expect(onChange).toHaveBeenCalledWith({ ...HOMEPAGE, showFeatured: false });
  });

  it("passes a change in the localities up with the switches kept", async () => {
    const onChange = setup();
    await userEvent.click(screen.getByRole("button", { name: "Remove: Adyar" }));
    expect(onChange).toHaveBeenCalledWith({
      ...HOMEPAGE,
      localities: [THREE_PLACES[1], THREE_PLACES[2]],
    });
  });

  it("hands the locality problems to their rows", () => {
    setup({ errors: { localities: { p1: { lng: "Outside the area." } } } });
    expect(screen.getByRole("textbox", { name: "Longitude 1" })).toBeInvalid();
  });

  it("turns every switch off while saving", () => {
    setup({ disabled: true });
    for (const control of screen.getAllByRole("switch")) expect(control).toBeDisabled();
  });

  it("keeps working as the page uses it, with its own state", async () => {
    function Page() {
      const [values, setValues] = useState(HOMEPAGE);
      return (
        <SiteHomepageFields
          values={values}
          onChange={setValues}
          localitiesMax={8}
          radii={RADII}
          defaultRadius={3}
          words={HOMEPAGE_WORDS}
        />
      );
    }
    render(<Page />);
    await userEvent.click(screen.getByRole("switch", { name: /Call to action/ }));
    expect(screen.getByRole("switch", { name: /Call to action/ })).not.toBeChecked();
  });
});

describe("UT-site-homepage-preview: the drawing of the home page (S7-T10)", () => {
  const words = { popular: "Popular chips", explore: "Explore tiles", on: "On", off: "Off" };
  const hiddenNote = { title: "Section hidden", text: "No localities." };
  const sections = [
    { label: "Hero", on: true },
    { label: "Why us", on: false },
  ];

  it("says On or Off in words for each section, not by colour alone", () => {
    const { container } = render(
      <SiteHomepagePreview
        sections={sections}
        popular={[]}
        tiles={[]}
        hiddenNote={hiddenNote}
        words={words}
      />,
    );
    expect(container.textContent).toContain("HeroOn");
    expect(container.textContent).toContain("Why usOff");
  });

  it("draws the chips and the tiles when there are localities", () => {
    const { container } = render(
      <SiteHomepagePreview
        sections={sections}
        popular={["Adyar", "Velachery"]}
        tiles={["Adyar", "Velachery", "Navalur"]}
        hiddenNote={hiddenNote}
        words={words}
      />,
    );
    expect(container.textContent).toContain("Popular chips");
    expect(container.textContent).toContain("Explore tiles");
    expect(container.textContent).toContain("Navalur");
    expect(container.textContent).not.toContain("Section hidden");
  });

  it("draws the note instead when there are no localities, hidden from a screen reader", () => {
    const { container } = render(
      <SiteHomepagePreview
        sections={sections}
        popular={[]}
        tiles={[]}
        hiddenNote={hiddenNote}
        words={words}
      />,
    );
    expect(container.querySelector("[data-slot='site-homepage-preview']")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.textContent).toContain("Section hidden");
    expect(container.textContent).not.toContain("Popular chips");
  });
});
