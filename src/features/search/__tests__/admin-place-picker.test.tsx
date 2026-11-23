// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { AdminPlacePicker } from "../admin-place-picker.client";

const places = en.domain.places;
const words = en.domain.placePicker;
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
  Promise.resolve(
    json({
      ok: true,
      data: [
        suggestion("p1", "KK Nagar", 13.0418, 80.2341),
        suggestion("p2", "KK Nagar East", 13.0402, 80.2399),
      ],
    }),
  );

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockReturnValue(new Promise<Response>(() => undefined));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function open() {
  const onPick = vi.fn();
  renderWithMessages(<AdminPlacePicker id="place" suffix="1" onPick={onPick} />);
  return { onPick, box: () => screen.getByRole("combobox", { name: `${words.label} 1` }) };
}

describe("UT-admin-place-picker: the place search box of the admin forms (ADR-140)", () => {
  it("asks our route as the admin picker after three characters and a pause, and asks nothing before", async () => {
    fetchMock.mockImplementation(answerKkNagar);
    const { box } = open();
    await userEvent.type(box(), "kk");
    await new Promise((done) => setTimeout(done, 450));
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.type(box(), " n");
    await screen.findByRole("option", { name: /KK Nagar East/ }, { timeout: 2000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [address] = fetchMock.mock.calls[0] ?? [];
    expect(address).toBe("/api/places/autocomplete?q=kk+n&source=admin_picker");
    // Only our own route is called, and nothing else about the admin goes with the text.
    expect(String(address).startsWith("/api/places/")).toBe(true);
  });

  it("reports the name and the point of the suggestion chosen, with the credit in the panel", async () => {
    fetchMock.mockImplementation(answerKkNagar);
    const { box, onPick } = open();
    await userEvent.type(box(), "kk n");
    const row = await screen.findByRole("option", { name: /KK Nagar East/ }, { timeout: 2000 });
    expect(screen.getByText(places.attribution.poweredBy)).toBeInTheDocument();
    await userEvent.click(row);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith({
      label: "KK Nagar East",
      lat: 13.0402,
      lng: 80.2399,
      city: "Chennai",
    });
    expect(box()).toHaveValue("KK Nagar East");
    expect(screen.getByText(words.picked.replace("{place}", "KK Nagar East"))).toBeInTheDocument();
  });

  it("works from the keyboard: arrows, then Enter, and the form around it is not submitted", async () => {
    fetchMock.mockImplementation(answerKkNagar);
    const onPick = vi.fn();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    renderWithMessages(
      <form onSubmit={onSubmit}>
        <AdminPlacePicker id="place" onPick={onPick} />
      </form>,
    );
    await userEvent.type(screen.getByRole("combobox"), "kk n");
    await screen.findByRole("option", { name: /KK Nagar East/ }, { timeout: 2000 });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith({
      label: "KK Nagar East",
      lat: 13.0402,
      lng: 80.2399,
      city: "Chennai",
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("never submits the form on Enter even when there is nothing to pick", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    renderWithMessages(
      <form onSubmit={onSubmit}>
        <AdminPlacePicker id="place" onPick={vi.fn()} />
      </form>,
    );
    await userEvent.type(screen.getByRole("combobox"), "ab{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("says suggestions are unavailable when the route fails, and the box keeps taking text", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { box, onPick } = open();
    await userEvent.type(box(), "kk nagar");
    expect(
      (await screen.findAllByText(places.unavailable.title, undefined, { timeout: 2000 }))[0],
    ).toBeInTheDocument();
    expect(screen.getAllByText(words.unavailableBody).length).toBeGreaterThan(0);
    expect(onPick).not.toHaveBeenCalled();
    expect(box()).toHaveValue("kk nagar");
  });

  it("says no places were found for text the provider does not know", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ ok: true, data: [] })));
    const { box } = open();
    await userEvent.type(box(), "zzzzz");
    expect(
      (await screen.findAllByText(places.empty.body, undefined, { timeout: 2000 }))[0],
    ).toBeInTheDocument();
  });

  it("says too many searches when the route refuses for its limit", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json({ ok: false, code: "RATE_LIMITED", reason: "limited", requestId: "r1" }, 429),
      ),
    );
    const { box } = open();
    await userEvent.type(box(), "kk nagar");
    expect(
      (await screen.findAllByText(places.limited.title, undefined, { timeout: 2000 }))[0],
    ).toBeInTheDocument();
  });

  it("is off when the form is saving", () => {
    renderWithMessages(<AdminPlacePicker id="place" disabled onPick={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
