// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { parseSearchParams } from "../params";
import { ResultsScreen } from "../results-screen";

const replace = vi.fn();
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push, refresh }) }));

const LOCALITIES = [
  { label: "Velachery", lat: 12.9815, lng: 80.2209, radiusKm: 4 },
  { label: "Adyar", lat: 13.0012, lng: 80.2565, radiusKm: 3 },
];

const FILTERED = parseSearchParams({
  listingType: "sale",
  propertyType: "apartment",
  bhk: "3",
  place: "Velachery",
  lat: "12.9815",
  lng: "80.2209",
});

function card(name: string) {
  return (
    <article key={name}>
      <a href={`/properties/${name}`}>{name}</a>
    </article>
  );
}

function renderScreen(props: Partial<Parameters<typeof ResultsScreen>[0]> = {}) {
  const cards = props.cards ?? [card("first-home"), card("second-home")];
  return renderWithMessages(
    <ResultsScreen
      params={FILTERED}
      status="ok"
      total={48}
      shown={2}
      localities={LOCALITIES}
      regionName="Chennai"
      cards={cards}
      {...props}
    />,
  );
}

const chips = () => screen.getByRole("group", { name: "Active filters" });

beforeEach(() => vi.clearAllMocks());

describe("ResultsScreen: heading, count and breadcrumb (S4-T04)", () => {
  it("names the search and counts the homes, with the place and the region", () => {
    renderScreen();
    expect(
      screen.getByRole("heading", { level: 1, name: "Apartments for sale in Velachery" }),
    ).toBeVisible();
    expect(screen.getByText("48 homes")).toBeVisible();
    expect(screen.getByText(/found in Velachery, Chennai/)).toBeVisible();
  });

  it("keeps the words region-neutral when the site content has no region", () => {
    renderScreen({ regionName: undefined });
    expect(screen.getByText(/found in Velachery$/)).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Locality" })).toHaveDisplayValue("Velachery");
    expect(screen.getByRole("option", { name: "All localities" })).toBeInTheDocument();
  });

  it("says Homes for sale and rent, with no place, when nothing is filtered", () => {
    renderScreen({ params: parseSearchParams({}) });
    expect(
      screen.getByRole("heading", { level: 1, name: "Homes for sale and rent" }),
    ).toBeVisible();
    expect(screen.getByText("48 homes")).toBeVisible();
    expect(screen.getByText("found")).toBeVisible();
  });

  it("uses the singular for one home and says 0 homes match when there is none", () => {
    const { unmount } = renderScreen({ total: 1, shown: 1, cards: [card("only-home")] });
    expect(screen.getByText("1 home")).toBeVisible();
    unmount();
    renderScreen({ total: 0, shown: 0, cards: [] });
    expect(screen.getByText("0 homes")).toBeVisible();
    expect(screen.getByText("match these filters")).toBeVisible();
  });

  it("draws the trail Home, Properties, then the place", () => {
    renderScreen();
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(trail).getByRole("link", { name: "Properties" })).toHaveAttribute(
      "href",
      "/properties",
    );
    expect(within(trail).getByText("Velachery")).toHaveAttribute("aria-current", "page");
  });

  it("draws no count line when the load failed", () => {
    renderScreen({ status: "failed", total: 0, shown: 0, cards: [] });
    expect(screen.queryByText(/homes? (found|match)/)).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load homes just now");
  });
});

describe("ResultsScreen: every choice writes the address (S4-T04)", () => {
  it("lists the applied filters as chips and takes one off, keeping scroll", async () => {
    renderScreen();
    expect(within(chips()).getAllByRole("button", { name: /^Remove filter/ })).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: 3 BHK" }));
    expect(replace).toHaveBeenCalledOnce();
    const [href, options] = replace.mock.calls[0] ?? [];
    expect(href).toBe(
      "/properties?lat=12.9815&listingType=sale&lng=80.2209&place=Velachery&propertyType=apartment",
    );
    expect(options).toEqual({ scroll: false });
  });

  it("takes the place off with its point", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Velachery" }));
    expect(replace.mock.calls[0]?.[0]).toBe(
      "/properties?bhk=3&listingType=sale&propertyType=apartment",
    );
  });

  it("clears every filter from the chips' Clear all and keeps sort and view", async () => {
    renderScreen({
      params: parseSearchParams({
        ...Object.fromEntries(
          new URLSearchParams("bhk=3&listingType=sale&label=prime&sort=price_asc&view=list"),
        ),
      }),
    });
    await userEvent.click(within(chips()).getByRole("button", { name: "Clear all" }));
    expect(replace.mock.calls[0]?.[0]).toBe("/properties?sort=price_asc&view=list");
  });

  it("changes the sort order and starts again from the first page", async () => {
    renderScreen({ params: parseSearchParams({ show: "36", bhk: "2" }) });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "price_desc");
    expect(replace.mock.calls[0]?.[0]).toBe("/properties?bhk=2&sort=price_desc");
  });

  it("switches to the list view", async () => {
    renderScreen({ params: parseSearchParams({}) });
    await userEvent.click(screen.getByRole("radio", { name: "List view" }));
    expect(replace.mock.calls[0]?.[0]).toBe("/properties?view=list");
  });

  it("sets and clears the quick label", async () => {
    const { unmount } = renderScreen({ params: parseSearchParams({}) });
    await userEvent.click(screen.getByRole("button", { name: "Prime" }));
    expect(replace.mock.calls[0]?.[0]).toBe("/properties?label=prime");
    unmount();
    renderScreen({ params: parseSearchParams({ label: "prime" }) });
    expect(screen.getByRole("button", { name: "Prime" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(replace.mock.calls[1]?.[0]).toBe("/properties");
  });

  it("changes a filter in the rail, turns a curated locality into its place, drops the budget for All", async () => {
    renderScreen({ params: parseSearchParams({ listingType: "sale", maxPrice: "7500000" }) });
    const rail = screen.getByRole("complementary", { name: "Filters" });
    await userEvent.selectOptions(
      within(rail).getByRole("combobox", { name: "Locality" }),
      "Adyar",
    );
    expect(replace.mock.calls[0]?.[0]).toBe(
      "/properties?lat=13.0012&listingType=sale&lng=80.2565&maxPrice=7500000&place=Adyar&r=3",
    );
    await userEvent.click(within(rail).getByRole("radio", { name: "All" }));
    expect(replace.mock.calls[1]?.[0]).toBe("/properties");
  });

  it("leaves the budget out of the rail while Looking to is All", () => {
    renderScreen({ params: parseSearchParams({}) });
    expect(screen.queryByRole("combobox", { name: "Max budget" })).not.toBeInTheDocument();
  });

  it("clears every filter, the label included, from the rail's Clear all", async () => {
    renderScreen({ params: parseSearchParams({ listingType: "rent", label: "prime", bhk: "2" }) });
    const rail = screen.getByRole("complementary", { name: "Filters" });
    await userEvent.click(within(rail).getByRole("button", { name: "Clear all" }));
    expect(replace.mock.calls[0]?.[0]).toBe("/properties");
  });

  it("applies the phone sheet once, with a push", async () => {
    renderScreen({ params: parseSearchParams({}) });
    await userEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    await userEvent.click(within(sheet).getByRole("radio", { name: "Rent" }));
    expect(replace).not.toHaveBeenCalled();
    await userEvent.click(within(sheet).getByRole("button", { name: /^Show/ }));
    expect(push).toHaveBeenCalledOnce();
    expect(push.mock.calls[0]?.[0]).toBe("/properties?listingType=rent");
  });

  it("shows the count on the sheet's button only while the choices are the applied ones", async () => {
    renderScreen({ params: parseSearchParams({}) });
    await userEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    const sheet = screen.getByRole("dialog", { name: "Filters" });
    expect(within(sheet).getByRole("button", { name: "Show 48 homes" })).toBeVisible();
    await userEvent.click(within(sheet).getByRole("radio", { name: "Rent" }));
    expect(within(sheet).getByRole("button", { name: "Show homes" })).toBeVisible();
  });
});

describe("ResultsScreen: the list and its states (S4-T04)", () => {
  it("shows the cards with how many of how many, and asks for twelve more", async () => {
    renderScreen({ params: parseSearchParams({ show: "12" }), total: 48, shown: 12 });
    expect(screen.getAllByText("Showing 12 of 48 homes").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Show more homes" }));
    expect(replace.mock.calls[0]?.[0]).toBe("/properties?show=24");
  });

  it("becomes Refine your search at the 120-home cap and moves focus to the heading", async () => {
    renderScreen({ params: parseSearchParams({ show: "120" }), total: 300, shown: 120 });
    window.scrollTo = vi.fn();
    await userEvent.click(screen.getByRole("button", { name: "Refine your search" }));
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("explains an empty result, clears the filters and offers the AI link only when given", async () => {
    const { unmount } = renderScreen({ total: 0, shown: 0, cards: [] });
    expect(screen.getByRole("heading", { name: "No homes match your filters" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Describe it in words/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(replace.mock.calls[0]?.[0]).toBe("/properties");
    unmount();
    renderScreen({ total: 0, shown: 0, cards: [], describeHref: "/ai-search" });
    expect(screen.getByRole("link", { name: /Describe it in words/ })).toHaveAttribute(
      "href",
      "/ai-search",
    );
  });

  it("keeps the filters on a failed load and asks the server again on Try again", async () => {
    renderScreen({ status: "failed", total: 0, shown: 0, cards: [] });
    expect(within(chips()).getAllByRole("button", { name: /^Remove filter/ })).toHaveLength(3);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
  });

  it("navigates nowhere in the Design Lab preview", async () => {
    renderScreen({ preview: true });
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: 3 BHK" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "price_asc");
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
