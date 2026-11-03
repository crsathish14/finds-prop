// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { PropertyCard, PropertyCardSkeleton, type PropertyCardData } from "../property-card";
import { CompareToggle, SaveButton } from "../property-card-controls.client";

const home: PropertyCardData = {
  href: "/properties/two-bhk-ab12cd",
  title: "Bright 2 BHK near the river",
  locality: "Adyar",
  city: "Chennai",
  rupees: 92_00_000,
  listingType: "sale",
  bedrooms: 2,
  bathrooms: 2,
  areaSqft: 1080,
  label: "featured",
  listedAgo: "2 days ago",
  typeLabel: "Apartment",
  summary: "Apartment in Adyar. Listed 2 days ago.",
  cover: { src: "/design-lab/listings/home-a.svg", alt: "A drawn house" },
};

const words = en.domain.propertyCard;

describe("PropertyCard: one home in a grid or a list (S4-T01)", () => {
  it("shows the price, title, place, facts and the sale and label badges", () => {
    renderWithMessages(<PropertyCard property={home} />);
    expect(screen.getByText("₹92 L")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: home.title })).toBeInTheDocument();
    expect(screen.getByText("Adyar, Chennai")).toBeInTheDocument();
    expect(screen.getByText("2 BHK")).toBeInTheDocument();
    expect(screen.getByText("2 baths")).toBeInTheDocument();
    expect(screen.getByText("1,080 sq.ft")).toBeInTheDocument();
    expect(screen.getByText(words.forSale)).toBeInTheDocument();
    expect(screen.getByText(words.label.featured)).toBeInTheDocument();
    expect(screen.getByText("2 days ago")).toBeInTheDocument();
    expect(screen.getByText("Apartment")).toBeInTheDocument();
  });

  it("is one link target: the title link goes to the home, and the picture has its alt text", () => {
    renderWithMessages(<PropertyCard property={home} />);
    const link = screen.getByRole("link", { name: home.title });
    expect(link).toHaveAttribute("href", home.href);
    expect(link).toHaveAttribute("data-stretched");
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByAltText("A drawn house")).toBeInTheDocument();
  });

  it("says For rent and adds /mo for a rental, with no label badge when there is none", () => {
    renderWithMessages(
      <PropertyCard property={{ ...home, rupees: 32_000, listingType: "rent", label: null }} />,
    );
    expect(screen.getByText("₹32,000/mo")).toBeInTheDocument();
    expect(screen.getByText(words.forRent)).toBeInTheDocument();
    expect(screen.queryByText(words.label.featured)).not.toBeInTheDocument();
  });

  it("leaves out facts that are missing, never showing blanks or zeros", () => {
    renderWithMessages(
      <PropertyCard
        property={{
          ...home,
          bedrooms: null,
          bathrooms: 0,
          areaSqft: undefined,
          listedAgo: undefined,
        }}
      />,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/^d+ BHK$/)).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows only the facts it has", () => {
    renderWithMessages(<PropertyCard property={{ ...home, bedrooms: null, bathrooms: null }} />);
    const facts = screen.getByRole("list");
    expect(within(facts).getAllByRole("listitem")).toHaveLength(1);
    expect(within(facts).getByText("1,080 sq.ft")).toBeInTheDocument();
  });

  it("shows the summary in the list layout only", () => {
    const grid = renderWithMessages(<PropertyCard property={home} layout="grid" />);
    expect(screen.queryByText(home.summary as string)).not.toBeInTheDocument();
    grid.unmount();
    renderWithMessages(<PropertyCard property={home} layout="list" />);
    expect(screen.getByText(home.summary as string)).toBeInTheDocument();
    expect(document.querySelector("[data-slot=property-card]")).toHaveAttribute(
      "data-layout",
      "list",
    );
  });

  it("draws the chosen ring when the home is chosen for compare", () => {
    renderWithMessages(<PropertyCard property={home} compared />);
    expect(document.querySelector("[data-slot=property-card]")).toHaveClass(
      "border-primary",
      "outline-primary",
    );
  });

  it("shows the illustrated tile when there is no picture", () => {
    renderWithMessages(<PropertyCard property={{ ...home, cover: null }} />);
    expect(document.querySelector("[data-slot=card-cover-fallback]")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("swaps to the illustrated tile when the picture fails to load", () => {
    renderWithMessages(<PropertyCard property={home} />);
    fireEvent.error(screen.getByAltText("A drawn house"));
    expect(document.querySelector("[data-slot=card-cover-fallback]")).toBeInTheDocument();
  });

  it("places the heart and Compare controls it is given, separate from the title link", () => {
    renderWithMessages(
      <PropertyCard
        property={home}
        save={<SaveButton saved={false} onToggle={vi.fn()} />}
        compare={<CompareToggle compared={false} onToggle={vi.fn()} />}
      />,
    );
    expect(screen.getByRole("button", { name: words.save })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.compare })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("SaveButton and CompareToggle", () => {
  it("toggle by click and say what they will do", async () => {
    const onSave = vi.fn();
    const onCompare = vi.fn();
    renderWithMessages(
      <>
        <SaveButton saved={false} onToggle={onSave} />
        <CompareToggle compared={false} onToggle={onCompare} />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: words.save }));
    await userEvent.click(screen.getByRole("button", { name: words.compare }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCompare).toHaveBeenCalledTimes(1);
  });

  it("show the saved and added states with aria-pressed", () => {
    renderWithMessages(
      <>
        <SaveButton saved onToggle={vi.fn()} />
        <CompareToggle compared onToggle={vi.fn()} />
      </>,
    );
    expect(screen.getByRole("button", { name: words.unsave })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: words.compared })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("disable Compare at three homes and say why", async () => {
    const onCompare = vi.fn();
    renderWithMessages(<CompareToggle compared={false} disabled onToggle={onCompare} />);
    const button = screen.getByRole("button", { name: words.compare });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", words.compareLimit);
    await userEvent.click(button);
    expect(onCompare).not.toHaveBeenCalled();
  });
});

describe("PropertyCardSkeleton", () => {
  it("is hidden from screen readers and keeps the card's box", () => {
    const { container } = renderWithMessages(<PropertyCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
