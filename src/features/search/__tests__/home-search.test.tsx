// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const fetchMock = vi.fn();

function suggestion(id: string, label: string, lat: number, lng: number) {
  return { id, label, detail: "Chennai, Tamil Nadu, India", kind: "area", lat, lng };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  push.mockClear();
  fetchMock.mockReset();
  // No test reaches the network: a lookup that nobody answered stays pending.
  fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const box = () => screen.getByRole("combobox", { name: words.locality.label });
const places = en.domain.places;

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

  it("keeps the curated localities as the Popular chips and asks nothing under three letters", async () => {
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.type(box(), "an");
    expect(fetchMock).not.toHaveBeenCalled();
    // The note is also read out by the polite live region, so it is on the page twice.
    expect(await screen.findAllByText("Type at least 3 characters")).not.toHaveLength(0);
    expect(screen.getByText(places.idle.bodyTyping)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anna Nagar" })).toBeInTheDocument();
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

describe("HomeSearch: place suggestions from Ola Maps (ADR-135)", () => {
  async function typeAndWait(text: string) {
    await userEvent.type(box(), text);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 2000 });
  }

  it("asks the route after three letters and a pause, and lists the places it finds with the credit", async () => {
    fetchMock.mockResolvedValue(
      json({ ok: true, data: [suggestion("p1", "KK Nagar", 13.0418, 80.2341)] }),
    );
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.type(box(), "kk n");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("option", { name: /KK Nagar/ }, { timeout: 2000 }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/places/autocomplete?q=kk+n&source=search_box");
    expect(screen.getByText(places.attribution.poweredBy)).toBeVisible();
  });

  it("searches by the place, its point and the default radius when a suggestion is picked", async () => {
    fetchMock.mockResolvedValue(
      json({ ok: true, data: [suggestion("p1", "KK Nagar", 13.0418, 80.2341)] }),
    );
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.type(box(), "kk n");
    await userEvent.click(
      await screen.findByRole("option", { name: /KK Nagar/ }, { timeout: 2000 }),
    );
    expect(box()).toHaveValue("KK Nagar");
    await userEvent.click(screen.getByRole("button", { name: words.search }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(
      "/properties?lat=13.0418&listingType=sale&lng=80.2341&place=KK+Nagar",
    );
  });

  it("picks with the keyboard and searches with the next Enter", async () => {
    fetchMock.mockResolvedValue(
      json({ ok: true, data: [suggestion("p1", "KK Nagar", 13.0418, 80.2341)] }),
    );
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.type(box(), "kk n");
    await screen.findByRole("option", { name: /KK Nagar/ }, { timeout: 2000 });
    await userEvent.keyboard("{Enter}");
    expect(push).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0]?.[0]).toContain("place=KK+Nagar");
  });

  it("searches the typed text as a locality when no suggestion is picked", async () => {
    fetchMock.mockResolvedValue(
      json({ ok: true, data: [suggestion("p1", "KK Nagar", 13.0418, 80.2341)] }),
    );
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.type(box(), "kk n{Escape}");
    await userEvent.click(screen.getByRole("button", { name: words.search }));
    expect(push).toHaveBeenCalledWith("/properties?listingType=sale&locality=kk+n");
  });

  it("searches the typed text as a locality once the picked name has been changed", async () => {
    fetchMock.mockResolvedValue(
      json({ ok: true, data: [suggestion("p1", "KK Nagar", 13.0418, 80.2341)] }),
    );
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.type(box(), "kk n");
    await userEvent.click(
      await screen.findByRole("option", { name: /KK Nagar/ }, { timeout: 2000 }),
    );
    await userEvent.type(box(), " West{Escape}");
    await userEvent.click(screen.getByRole("button", { name: words.search }));
    expect(push).toHaveBeenCalledWith("/properties?listingType=sale&locality=KK+Nagar+West");
  });

  it("keeps a curated name a curated place, with its own point and radius", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: [suggestion("p9", "Adyar", 1.5, 2.5)] }));
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await userEvent.type(box(), "adyar");
    await userEvent.click(await screen.findByRole("option", { name: /Adyar/ }, { timeout: 2000 }));
    await userEvent.click(screen.getByRole("button", { name: words.search }));
    expect(push).toHaveBeenCalledWith(
      "/properties?lat=13.0012&listingType=sale&lng=80.2565&place=Adyar&r=3",
    );
  });

  it("says suggestions are unavailable, offers the keyword row, and still searches", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await typeAndWait("velach");
    expect(await screen.findAllByText(places.unavailable.title)).not.toHaveLength(0);
    const keyword = screen.getByRole("option", { name: /Search for “velach” as a keyword/ });
    expect(screen.getByRole("button", { name: words.search })).toBeEnabled();
    await userEvent.click(keyword);
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/properties?listingType=sale&locality=velach");
  });

  it("searches once, not twice, when Enter chooses the keyword row", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await typeAndWait("velach");
    await screen.findAllByText(places.unavailable.title);
    await userEvent.keyboard("{Enter}");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/properties?listingType=sale&locality=velach");
  });

  it("says there are too many searches when the route is limited, and Search still works", async () => {
    fetchMock.mockResolvedValue(
      json(
        { ok: false, code: "RATE_LIMITED", reason: "limited", retryAfter: 5, requestId: "r1" },
        429,
      ),
    );
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await typeAndWait("velach");
    expect(await screen.findAllByText(places.limited.title)).not.toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: words.search }));
    expect(push).toHaveBeenCalledWith("/properties?listingType=sale&locality=velach");
  });

  it("says nothing was found, with the keyword row, when the list is empty", async () => {
    fetchMock.mockResolvedValue(json({ ok: true, data: [] }));
    renderWithMessages(<HomeSearch localities={CURATED} projectsHref="/projects" />);
    await typeAndWait("zzzzz");
    expect(await screen.findAllByText("No places found for “zzzzz”")).not.toHaveLength(0);
    expect(screen.getByRole("option", { name: /Search for “zzzzz” as a keyword/ })).toBeVisible();
  });
});
