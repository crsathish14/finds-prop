// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RADIUS_CHOICES_KM, type FilterValues } from "@/config/search-options";
import { renderWithMessages } from "../../../../tests/render-intl";
import { FilterRail } from "../filters";
import { PropertyCard, type PropertyCardData } from "../property-card";

const VALUES: FilterValues = {
  intent: "buy",
  locality: null,
  propertyType: null,
  bedrooms: null,
  maxBudget: null,
  sort: "newest",
};

function rail(extra: Partial<Parameters<typeof FilterRail>[0]> = {}) {
  const onChange = vi.fn();
  renderWithMessages(
    <FilterRail
      values={VALUES}
      onChange={onChange}
      localities={["Velachery", "Adyar"]}
      allLocalitiesLabel="All of Chennai"
      {...extra}
    />,
  );
  return onChange;
}

describe("FilterRail with a place search (ADR-131)", () => {
  it("draws no distance field and keeps the Locality list when the page gives neither", () => {
    rail();
    expect(screen.queryByRole("group", { name: "Search within" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Locality" })).toBeInTheDocument();
  });

  it("puts the page's place box in place of the Locality list and says Tamil Nadu only", () => {
    rail({ placeField: <input aria-label="Place search" /> });
    expect(screen.getByRole("textbox", { name: "Place search" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Locality" })).not.toBeInTheDocument();
    expect(screen.getByText("Tamil Nadu only for now.")).toBeInTheDocument();
  });

  it("offers the four distances, with 5 km chosen when none is set", () => {
    rail({ radiusChoices: RADIUS_CHOICES_KM });
    const group = screen.getByRole("group", { name: "Search within" });
    const chips = within(group).getAllByRole("button");
    expect(chips.map((chip) => chip.textContent)).toEqual(["2 km", "5 km", "10 km", "15 km"]);
    expect(within(group).getByRole("button", { name: "Within 5 km" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "Within 10 km" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports the chosen distance with the rest of the values", async () => {
    const onChange = rail({ radiusChoices: RADIUS_CHOICES_KM });
    await userEvent.click(screen.getByRole("button", { name: "Within 15 km" }));
    expect(onChange).toHaveBeenCalledWith({ ...VALUES, radiusKm: 15 });
  });

  it("marks the distance that the values hold", () => {
    rail({ values: { ...VALUES, radiusKm: 2 }, radiusChoices: RADIUS_CHOICES_KM });
    expect(screen.getByRole("button", { name: "Within 2 km" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("PropertyCard distance (ADR-131)", () => {
  const home: PropertyCardData = {
    href: "#home",
    title: "A home",
    locality: "Velachery",
    city: "Chennai",
    rupees: 9_000_000,
    listingType: "sale",
  };

  it("shows the distance after the place when the page gives it", () => {
    renderWithMessages(<PropertyCard property={{ ...home, distanceText: "2.4 km away" }} />);
    expect(screen.getByText("2.4 km away")).toBeInTheDocument();
  });

  it("shows no distance when none is given", () => {
    renderWithMessages(<PropertyCard property={home} />);
    expect(screen.queryByText(/km away/)).not.toBeInTheDocument();
  });
});
