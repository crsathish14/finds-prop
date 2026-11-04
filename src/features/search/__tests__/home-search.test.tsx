// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { CuratedLocality } from "../from-card";
import { HomeSearch } from "../home-search.client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const words = en.domain.searchCard;

const CURATED: CuratedLocality[] = [
  { label: "Adyar", lat: 13.0012, lng: 80.2565, radiusKm: 3 },
  { label: "Anna Nagar", lat: 13.085, lng: 80.2101, radiusKm: 4 },
];

beforeEach(() => push.mockClear());

describe("HomeSearch: the search card joined to the results address (S4-T06)", () => {
  it("opens the results for the card's choices, a curated locality as a place", async () => {
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.click(screen.getByRole("radio", { name: words.rent }));
    await userEvent.type(
      screen.getByRole("combobox", { name: words.locality.label }),
      "adyar{Escape}",
    );
    await userEvent.click(screen.getByRole("button", { name: words.search }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      "/properties?lat=13.0012&listingType=rent&lng=80.2565&place=Adyar&r=3",
    );
  });

  it("sends other text as a locality text match", async () => {
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.type(
      screen.getByRole("combobox", { name: words.locality.label }),
      "Thiruvanmiyur{Enter}",
    );
    expect(push).toHaveBeenCalledWith("/properties?listingType=sale&locality=Thiruvanmiyur");
  });

  it("searches all homes to buy when nothing is chosen", async () => {
    renderWithMessages(<HomeSearch localities={[]} projectsHref="/projects" />);
    await userEvent.click(screen.getByRole("button", { name: words.search }));
    expect(push).toHaveBeenCalledWith("/properties?listingType=sale");
  });

  it("suggests the curated localities that match what is typed", async () => {
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.type(screen.getByRole("combobox", { name: words.locality.label }), "ann");
    expect(await screen.findByRole("option", { name: /Anna Nagar/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: /Adyar/ })).not.toBeInTheDocument(),
    );
  });

  it("shows the Popular chips from the curated list, and the two Quick picks, as links", () => {
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    expect(screen.getByRole("link", { name: "Adyar" })).toHaveAttribute(
      "href",
      "/properties?lat=13.0012&lng=80.2565&place=Adyar&r=3",
    );
    expect(screen.getByRole("link", { name: words.quickPickBedrooms })).toHaveAttribute(
      "href",
      "/properties?bhk=3",
    );
    expect(screen.getByRole("link", { name: words.quickPickBudget })).toHaveAttribute(
      "href",
      "/properties?label=budget",
    );
  });

  it("leaves the Popular chips out when no locality is curated, but keeps the Quick picks", () => {
    renderWithMessages(<HomeSearch localities={[]} projectsHref="/projects" />);
    expect(screen.queryByText(words.popular)).not.toBeInTheDocument();
    expect(screen.getByText(words.quickPicks)).toBeInTheDocument();
  });

  it("draws the AI link only when it is given an address", () => {
    const view = renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    expect(
      screen.queryByRole("link", { name: new RegExp(words.describeInWords) }),
    ).not.toBeInTheDocument();
    view.unmount();
    renderWithMessages(
      <HomeSearch localities={CURATED} projectsHref="/projects" aiSearchHref="/ai-search" />,
    );
    expect(screen.getByRole("link", { name: new RegExp(words.describeInWords) })).toHaveAttribute(
      "href",
      "/ai-search",
    );
  });
});
