// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { amenityRows, hasAmenity, type CompareColumn } from "../table";
import { CompareScreen } from "../compare-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

const words = en.compare;

const column = (overrides: Partial<CompareColumn> = {}): CompareColumn => ({
  shortId: "k3x9a2bd",
  href: "/properties/3-bhk-velachery-k3x9a2bd",
  title: "3 BHK apartment with clubhouse",
  listingType: "sale",
  price: 12_500_000,
  perSqftRupees: 8803,
  propertyType: "apartment",
  place: "Velachery, Chennai",
  areaSqft: 1420,
  bedrooms: 3,
  bathrooms: 2,
  furnishing: "semi",
  amenities: ["Gym", "Lift"],
  label: "featured",
  cover: null,
  ...overrides,
});

const SECOND = column({
  shortId: "m4y8b3ce",
  href: "/properties/2-bhk-adyar-m4y8b3ce",
  title: "2 BHK flat near the river",
  listingType: "rent",
  price: 48_000,
  perSqftRupees: undefined,
  place: "Adyar, Chennai",
  areaSqft: null,
  bedrooms: 2,
  bathrooms: null,
  furnishing: null,
  amenities: ["lift", "Near Beach"],
  label: null,
});

describe("amenityRows and hasAmenity: the rows of the amenities (S4-T02)", () => {
  it("lists every amenity any home has once, in the order met, ignoring capitals", () => {
    expect(amenityRows([column(), SECOND])).toEqual(["Gym", "Lift", "Near Beach"]);
  });

  it("knows who has what, ignoring capitals", () => {
    expect(hasAmenity(SECOND, "Lift")).toBe(true);
    expect(hasAmenity(SECOND, "Gym")).toBe(false);
  });
});

describe("CompareScreen: the table (S4-T02)", () => {
  function table() {
    renderWithMessages(<CompareScreen columns={[column(), SECOND]} preview />);
    return screen.getByRole("table", { name: "Comparison of 2 homes" });
  }

  it("is named by how many homes it compares", () => {
    expect(table()).toBeInTheDocument();
  });

  it("has the page heading, the line and the trail", () => {
    renderWithMessages(<CompareScreen columns={[column(), SECOND]} preview />);
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    expect(screen.getByText(words.subtitle)).toBeVisible();
    expect(screen.getByRole("navigation", { name: words.crumb.nav })).toBeInTheDocument();
  });

  it("heads each column with the tags, the title as a link, the price and the two actions", () => {
    const view = within(table());
    expect(view.getByRole("link", { name: "3 BHK apartment with clubhouse" })).toHaveAttribute(
      "href",
      "/properties/3-bhk-velachery-k3x9a2bd",
    );
    expect(view.getByText(en.domain.propertyCard.label.featured)).toBeVisible();
    expect(view.getAllByRole("link", { name: words.table.viewHome })).toHaveLength(2);
    expect(
      view.getByRole("button", {
        name: words.table.removeLabel.replace("{title}", "2 BHK flat near the river"),
      }),
    ).toBeInTheDocument();
  });

  it("has a label column and the rows of the UX, in order", () => {
    const shown = table();
    const text = (shown.textContent ?? "").replace(/\s+/g, " ");
    const order = [
      words.table.overview,
      words.table.price,
      words.table.perSqft,
      words.table.propertyType,
      words.table.facts,
      words.table.locality,
      words.table.area,
      words.table.bedrooms,
      words.table.bathrooms,
      words.table.furnishing,
      words.table.amenities,
    ].map((label) => text.indexOf(label));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((first, second) => first - second)).toEqual(order);
    for (const label of [words.table.price, words.table.area]) {
      const header = within(shown).getAllByRole("rowheader", { name: label })[0];
      expect(header).toHaveAttribute("scope", "row");
    }
  });

  it("shows prices, and a rent's per month with Not applicable for its price per sq.ft", () => {
    const view = within(table());
    expect(view.getAllByText("₹1.25 Cr").length).toBeGreaterThan(0);
    expect(view.getAllByText(/₹48,000/).length).toBeGreaterThan(0);
    expect(view.getByText("₹8,803 per sq.ft")).toBeVisible();
    expect(view.getByText(words.table.notApplicable)).toBeVisible();
  });

  it("says Not listed for what a home does not have, instead of a blank", () => {
    const view = within(table());
    // second home: no area, no bathrooms, no furnishing
    expect(view.getAllByText(words.table.notListed).length).toBeGreaterThanOrEqual(3);
  });

  it("has a Yes or Not listed in every column for every amenity any home has", () => {
    const view = within(table());
    for (const amenity of ["Gym", "Lift", "Near Beach"]) {
      const row = view.getByRole("rowheader", { name: amenity }).closest("tr");
      expect(row?.querySelectorAll("td")).toHaveLength(2);
    }
    const gym = view.getByRole("rowheader", { name: "Gym" }).closest("tr") as HTMLElement;
    expect(within(gym).getByText(words.table.yes)).toBeVisible();
    expect(within(gym).getByText(words.table.notListed)).toBeVisible();
  });

  it("leaves the amenities section out when no home has any", () => {
    renderWithMessages(
      <CompareScreen columns={[column({ amenities: [] }), { ...SECOND, amenities: [] }]} preview />,
    );
    expect(screen.queryByText(words.table.amenities)).not.toBeInTheDocument();
  });

  it("draws three columns for three homes", () => {
    renderWithMessages(
      <CompareScreen
        columns={[column(), SECOND, column({ shortId: "n5z7c4dh", title: "A third home" })]}
        preview
      />,
    );
    const view = within(screen.getByRole("table", { name: "Comparison of 3 homes" }));
    expect(view.getAllByRole("link", { name: words.table.viewHome })).toHaveLength(3);
  });
});

describe("CompareScreen: fewer than two homes (S4-T02)", () => {
  it("asks to choose at least two, with the count of one and a way to browse", () => {
    renderWithMessages(<CompareScreen columns={[column()]} preview />);
    expect(screen.getByRole("heading", { name: words.empty.title })).toBeVisible();
    expect(screen.getByText(words.empty.bodyOne)).toBeVisible();
    expect(screen.getByRole("link", { name: words.empty.browse })).toHaveAttribute(
      "href",
      "/properties",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says so when none is chosen", () => {
    renderWithMessages(<CompareScreen columns={[]} preview />);
    expect(screen.getByText(words.empty.bodyNone)).toBeVisible();
  });
});
