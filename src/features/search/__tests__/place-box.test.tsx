// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { parseSearchParams } from "../params";
import { ResultsScreen } from "../results-screen";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
}));

const LOCALITIES = [{ label: "Velachery", lat: 12.9815, lng: 80.2209, radiusKm: 4 }];
const places = en.domain.places;
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

/** A fresh answer each time: a response body can be read only once. */
const answerKkNagar = () =>
  Promise.resolve(json({ ok: true, data: [suggestion("p1", "KK Nagar", 13.0418, 80.2341)] }));

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  fetchMock.mockReset();
  fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function renderScreen(raw: Record<string, string> = { listingType: "sale" }) {
  return renderWithMessages(
    <ResultsScreen
      params={parseSearchParams(raw)}
      status="ok"
      total={12}
      shown={1}
      localities={LOCALITIES}
      regionName="Chennai"
      cards={<article>home</article>}
    />,
  );
}

const rail = () => screen.getByRole("complementary", { name: "Filters" });
const railBox = () => within(rail()).getByRole("combobox", { name: "Locality" });

describe("The Locality field of the results filters is a place search box (ADR-135)", () => {
  it("replaces the Locality list on the rail, with the Tamil Nadu note, and shows the chosen place", () => {
    renderScreen({ listingType: "sale", place: "KK Nagar", lat: "13.0418", lng: "80.2341" });
    expect(railBox()).toHaveValue("KK Nagar");
    expect(within(rail()).getByText("Tamil Nadu only for now.")).toBeInTheDocument();
    expect(
      within(rail()).queryByRole("option", { name: "All localities" }),
    ).not.toBeInTheDocument();
  });

  it("opens no panel and asks nothing while the box holds the place already chosen", async () => {
    renderScreen({ listingType: "sale", place: "KK Nagar", lat: "13.0418", lng: "80.2341" });
    await userEvent.click(railBox());
    expect(screen.queryByText(places.noResults)).not.toBeInTheDocument();
    expect(screen.queryByText(places.attribution.poweredBy)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sets the place, its point and keeps the radius when a suggestion is picked", async () => {
    fetchMock.mockImplementation(answerKkNagar);
    renderScreen({
      listingType: "sale",
      place: "Old place",
      lat: "13.1",
      lng: "80.1",
      ["r"]: "10",
      bhk: "2",
    });
    await userEvent.clear(railBox());
    // Emptying the box takes the place off at once.
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toBe("/properties?bhk=2&listingType=sale");
    replace.mockClear();

    await userEvent.type(railBox(), "kk n");
    await userEvent.click(
      await screen.findByRole("option", { name: /KK Nagar/ }, { timeout: 2000 }),
    );
    expect(replace).toHaveBeenCalledTimes(1);
    // The box had been emptied, so the page's own address (which still held r=10) is what is kept.
    expect(replace.mock.calls[0]?.[0]).toBe(
      "/properties?bhk=2&lat=13.0418&listingType=sale&lng=80.2341&place=KK+Nagar&r=10",
    );
  });

  it("keeps the picked place and its point when another filter changes", async () => {
    renderScreen({
      listingType: "sale",
      place: "KK Nagar",
      lat: "13.0418",
      lng: "80.2341",
      ["r"]: "8",
    });
    await userEvent.selectOptions(
      within(rail()).getByRole("combobox", { name: "Property type" }),
      "villa",
    );
    expect(replace.mock.calls[0]?.[0]).toBe(
      "/properties?lat=13.0418&listingType=sale&lng=80.2341&place=KK+Nagar&propertyType=villa&r=8",
    );
  });

  it("takes the place, its point and the radius off when the box is cleared", async () => {
    renderScreen({
      listingType: "sale",
      place: "KK Nagar",
      lat: "13.0418",
      lng: "80.2341",
      ["r"]: "8",
    });
    await userEvent.click(within(rail()).getByRole("button", { name: places.clear }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toBe("/properties?listingType=sale");
  });

  it("searches typed text that was not picked as a locality, with Enter", async () => {
    renderScreen();
    await userEvent.type(railBox(), "Thiruvanmiyur{Enter}");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toBe("/properties?listingType=sale&locality=Thiruvanmiyur");
  });

  it("does not reload the results while the visitor is only typing", async () => {
    renderScreen();
    await userEvent.type(railBox(), "Thiruv");
    expect(replace).not.toHaveBeenCalled();
  });

  it("turns a typed curated name into that place, as before", async () => {
    renderScreen();
    await userEvent.type(railBox(), "velachery{Enter}");
    expect(replace.mock.calls[0]?.[0]).toBe(
      "/properties?lat=12.9815&listingType=sale&lng=80.2209&place=Velachery&r=4",
    );
  });

  it("applies once when Enter picks a highlighted suggestion", async () => {
    fetchMock.mockImplementation(answerKkNagar);
    renderScreen();
    await userEvent.type(railBox(), "kk n");
    await screen.findByRole("option", { name: /KK Nagar/ }, { timeout: 2000 });
    await userEvent.keyboard("{Enter}");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toContain("place=KK+Nagar");
  });

  it("says suggestions are unavailable and the keyword row still searches the text", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderScreen();
    await userEvent.type(railBox(), "velach");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 2000 });
    expect(await screen.findAllByText(places.unavailable.title)).not.toHaveLength(0);
    await userEvent.click(screen.getByRole("option", { name: /Search for “velach” as a keyword/ }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toBe("/properties?listingType=sale&locality=velach");
  });

  it("shows a place chosen from elsewhere (a chip removed) in the box", async () => {
    const view = renderScreen({
      listingType: "sale",
      place: "KK Nagar",
      lat: "13.0418",
      lng: "80.2341",
    });
    expect(railBox()).toHaveValue("KK Nagar");
    view.unmount();
    renderScreen({ listingType: "sale" });
    expect(railBox()).toHaveValue("");
  });
});

describe("The Locality field of the phone's filter sheet is the same box", () => {
  async function openSheet() {
    await userEvent.click(screen.getByRole("button", { name: /^Filters/ }));
    return screen.getByRole("dialog", { name: "Filters" });
  }

  it("keeps the picked place as a draft until Show is pressed, then pushes it with its point", async () => {
    fetchMock.mockImplementation(answerKkNagar);
    renderScreen({ listingType: "sale", ["r"]: "10" });
    const sheet = await openSheet();
    const box = within(sheet).getByRole("combobox", { name: "Locality" });
    await userEvent.type(box, "kk n");
    await userEvent.click(
      await screen.findByRole("option", { name: /KK Nagar/ }, { timeout: 2000 }),
    );
    expect(box).toHaveValue("KK Nagar");
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(within(sheet).getByRole("button", { name: /^Show/ }));
    expect(push).toHaveBeenCalledTimes(1);
    // No place was in the address, so there is no radius to keep (the radius needs a place).
    expect(push.mock.calls[0]?.[0]).toBe(
      "/properties?lat=13.0418&listingType=sale&lng=80.2341&place=KK+Nagar",
    );
  });

  it("applies text that was typed but not picked when Show is pressed", async () => {
    renderScreen({ listingType: "sale" });
    const sheet = await openSheet();
    await userEvent.type(
      within(sheet).getByRole("combobox", { name: "Locality" }),
      "Adyar Gate{Escape}",
    );
    await userEvent.click(within(sheet).getByRole("button", { name: /^Show/ }));
    expect(push.mock.calls[0]?.[0]).toBe("/properties?listingType=sale&locality=Adyar+Gate");
  });

  it("empties the box with Clear all", async () => {
    renderScreen({ listingType: "sale", place: "KK Nagar", lat: "13.0418", lng: "80.2341" });
    const sheet = await openSheet();
    const box = within(sheet).getByRole("combobox", { name: "Locality" });
    expect(box).toHaveValue("KK Nagar");
    await userEvent.click(within(sheet).getByRole("button", { name: "Clear all" }));
    expect(box).toHaveValue("");
  });
});
