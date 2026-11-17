// @vitest-environment jsdom
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { ListingLocationFieldProps, PlaceAutocompleteSuggestion } from "@/types/places";
import { ListingLocationField } from "../listing-location-field.client";

const words = en.domain.locationField;
const places = en.domain.places;
const fetchMock = vi.fn();

const STREET: PlaceAutocompleteSuggestion = {
  id: "s1",
  label: "Velachery Main Road",
  detail: "Velachery, Chennai, Tamil Nadu 600042, India",
  kind: "street",
  lat: 12.9815,
  lng: 80.2209,
};
const AREA: PlaceAutocompleteSuggestion = {
  id: "a1",
  label: "Velachery",
  detail: "Chennai, Tamil Nadu, India",
  kind: "area",
  lat: 12.9791,
  lng: 80.2184,
};
const CURATED = [
  { label: "Adyar", lat: 13.0012, lng: 80.2565 },
  { label: "Velachery", lat: 12.9791, lng: 80.2184 },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
const answer = (data: unknown[]) => () => Promise.resolve(json({ ok: true, data }));
const unavailable = () =>
  Promise.resolve(
    json({ ok: false, code: "UPSTREAM_FAILED", reason: "unavailable", requestId: "r" }, 502),
  );
const limited = () =>
  Promise.resolve(
    json(
      { ok: false, code: "RATE_LIMITED", reason: "limited", retryAfter: 5, requestId: "r" },
      429,
    ),
  );

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function open(props: Partial<ListingLocationFieldProps> = {}) {
  const handlers = {
    onPick: vi.fn(),
    onPickArea: vi.fn(),
    onChange: vi.fn(),
  };
  const view = renderWithMessages(
    <ListingLocationField
      held={null}
      areas={CURATED}
      errorText={null}
      disabled={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, view };
}

const addressBox = () => screen.getByRole("combobox", { name: words.title });
const areaBox = () => screen.getByRole("combobox", { name: words.areaTitle });
const chooseArea = () => userEvent.click(screen.getByRole("button", { name: words.chooseArea }));

describe("UT-listing-location-field: the connected location field of the address step (ADR-141)", () => {
  it("starts as the address search, with the hint, the Ola Maps note and the way to choose an area", () => {
    open();
    expect(screen.getByRole("group", { name: /Where is the property\?/ })).toBeInTheDocument();
    expect(addressBox()).toBeInTheDocument();
    expect(screen.getByText(words.hint)).toBeInTheDocument();
    expect(screen.getByText(/Suggestions come from Ola Maps/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: words.chooseArea })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks our route as the listing form after three characters and a pause, and never before", async () => {
    fetchMock.mockImplementation(answer([STREET]));
    open();
    await userEvent.type(addressBox(), "ve");
    await new Promise((done) => setTimeout(done, 450));
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.type(addressBox(), "l");
    await screen.findByRole("option", { name: /Velachery Main Road/ }, { timeout: 2000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/places/autocomplete?q=vel&source=listing_form");
    // The credit the terms ask for stays in the panel.
    expect(screen.getByText(places.attribution.poweredBy)).toBeInTheDocument();
  });

  it("reports the whole suggestion with its point when one is chosen, by click and by keyboard", async () => {
    fetchMock.mockImplementation(answer([STREET, AREA]));
    const { onPick } = open();
    await userEvent.type(addressBox(), "vel");
    await userEvent.click(
      await screen.findByRole("option", { name: /Velachery Main Road/ }, { timeout: 2000 }),
    );
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(STREET);
  });

  it("has no keyword row: nothing here is searched by keyword", async () => {
    fetchMock.mockImplementation(answer([]));
    open();
    await userEvent.type(addressBox(), "zzz");
    await screen.findAllByText(/No places found for/, undefined, { timeout: 2000 });
    expect(screen.queryByText(/as a keyword/)).toBeNull();
  });

  it("shows the place that is held with Change, and nothing to search", async () => {
    const { onChange } = open({
      held: { label: "Velachery Main Road", detail: "Chennai", approximate: false },
    });
    expect(screen.getByText(words.foundTitle)).toBeInTheDocument();
    expect(screen.getByText("Velachery Main Road")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText(words.visitorsSee)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: words.change }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("shows an area as approximate", () => {
    open({ held: { label: "Velachery", approximate: true } });
    expect(screen.getByText(words.approximateTitle)).toBeInTheDocument();
    expect(screen.getByText(words.approximateNote)).toBeInTheDocument();
  });

  describe("choose the area instead", () => {
    it("asks for areas and nothing finer, and a chosen one is reported as an area", async () => {
      fetchMock.mockImplementation(answer([STREET, AREA]));
      const { onPick } = open();
      await chooseArea();
      expect(screen.getByRole("group", { name: /Which area is it in\?/ })).toBeInTheDocument();
      await userEvent.type(areaBox(), "vel");
      await screen.findByRole("option", { name: /^Velachery/ }, { timeout: 2000 });
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        "/api/places/autocomplete?q=vel&source=listing_form",
      );
      // The street is not an area, so it is not offered.
      expect(screen.queryByRole("option", { name: /Velachery Main Road/ })).toBeNull();
      await userEvent.click(screen.getByRole("option", { name: /^Velachery/ }));
      expect(onPick).toHaveBeenCalledWith({ ...AREA, kind: "area" });
    });

    it("says no places when none of the answers is an area", async () => {
      fetchMock.mockImplementation(answer([STREET]));
      open();
      await chooseArea();
      await userEvent.type(areaBox(), "vel");
      await screen.findAllByText(/No places found for/, undefined, { timeout: 2000 });
    });

    it("goes back to the address search, with the box empty", async () => {
      open();
      await userEvent.type(addressBox(), "vel");
      await chooseArea();
      await userEvent.click(screen.getByRole("button", { name: words.searchInstead }));
      expect(addressBox()).toHaveValue("");
    });
  });

  describe("when suggestions cannot be fetched", () => {
    it("says so and gives the curated areas as a list, so posting never stops", async () => {
      fetchMock.mockImplementation(unavailable);
      const { onPickArea, onPick } = open();
      await userEvent.type(addressBox(), "vel");
      const list = await screen.findByRole("combobox", { name: /Area/ }, { timeout: 2000 });
      expect(screen.getByText(places.unavailable.title)).toBeInTheDocument();
      expect(screen.getByText(words.unavailableBody)).toBeInTheDocument();
      await userEvent.selectOptions(list, "1");
      expect(onPickArea).toHaveBeenCalledWith(CURATED[1]);
      expect(onPick).not.toHaveBeenCalled();
    });

    it("lists the areas in the order the site gives them, behind a first line that chooses nothing", async () => {
      fetchMock.mockImplementation(unavailable);
      open();
      await userEvent.type(addressBox(), "vel");
      const list = await screen.findByRole("combobox", { name: /Area/ }, { timeout: 2000 });
      const options = Array.from((list as HTMLSelectElement).options).map((option) => option.text);
      expect(options).toEqual([en.postProperty.location.areaOption, "Adyar", "Velachery"]);
    });

    it("also gives the list when the area search is unavailable, or we are asked to wait", async () => {
      for (const failing of [unavailable, limited]) {
        fetchMock.mockReset();
        fetchMock.mockImplementation(failing);
        const { view } = open();
        await chooseArea();
        await userEvent.type(areaBox(), "vel");
        await screen.findByRole("combobox", { name: /^Area$/ }, { timeout: 2000 });
        view.unmount();
      }
    });

    it("keeps the box and says so when there are no curated areas to offer", async () => {
      fetchMock.mockImplementation(unavailable);
      open({ areas: [] });
      await userEvent.type(addressBox(), "vel");
      await screen.findAllByText(places.unavailable.title, undefined, { timeout: 2000 });
      // Nothing to choose from, so the box stays and the owner can try again.
      expect(addressBox()).toBeInTheDocument();
      expect(screen.queryByText(/as a keyword/)).toBeNull();
    });

    it("lets the owner try the address search again after the list", async () => {
      fetchMock.mockImplementation(unavailable);
      open();
      await userEvent.type(addressBox(), "vel");
      await screen.findByRole("combobox", { name: /Area/ }, { timeout: 2000 });
      await userEvent.click(screen.getByRole("button", { name: words.searchInstead }));
      await waitFor(() => expect(addressBox()).toHaveValue(""));
    });
  });

  it("shows the problem with the place as an alert, and names it for the group", () => {
    open({ errorText: words.required });
    expect(screen.getByRole("alert")).toHaveTextContent(words.required);
    expect(screen.getByRole("group", { name: /Where is the property\?/ })).toHaveAttribute(
      "aria-describedby",
    );
  });

  it("switches the boxes off while the step is saving", () => {
    open({ disabled: true });
    expect(addressBox()).toBeDisabled();
  });
});
