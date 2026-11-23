// @vitest-environment jsdom
import { resolveHomeOrder } from "@/features/site";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPlacePicker } from "@/features/search/admin-place-picker.client";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import type { HomepageFormValues } from "../form";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { HomepageForm } = await import("../homepage-form.client");

const ok: ActionResult<unknown> = { ok: true, data: { key: "homepage" } };
const places = en.domain.places;
const fetchMock = vi.fn();

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const answerKkNagar = () =>
  Promise.resolve(
    json({
      ok: true,
      data: [
        {
          id: "p1",
          label: "KK Nagar",
          detail: "Chennai, Tamil Nadu, India",
          kind: "area",
          lat: 13.04181234,
          lng: 80.2341,
        },
      ],
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  fetchMock.mockImplementation(answerKkNagar);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const HOMEPAGE: HomepageFormValues = {
  order: resolveHomeOrder(),
  showFeatured: true,
  showProjectTypes: true,
  showDiscovery: true,
  showWhyUs: true,
  showCta: true,
  localities: [
    { label: "Adyar", lat: "13.0067", lng: "80.2573", radiusKm: "4" },
    { label: "", lat: "", lng: "", radiusKm: "3" },
  ],
};

function open(save = vi.fn().mockResolvedValue(ok), withPicker = true) {
  renderWithMessages(
    <HomepageForm
      initial={HOMEPAGE}
      save={save}
      {...(withPicker ? { placePicker: AdminPlacePicker } : {})}
    />,
  );
  return save;
}

const pickKkNagarInRow = async (row: number) => {
  await userEvent.type(screen.getByRole("combobox", { name: `Find a place ${row}` }), "kk n");
  await userEvent.click(await screen.findByRole("option", { name: /KK Nagar/ }, { timeout: 2000 }));
};

describe("UT-homepage-page with the place picker (ADR-140)", () => {
  it("has a Find a place box in each locality row, and none when the page gives no picker", () => {
    open();
    expect(screen.getByRole("combobox", { name: "Find a place 1" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Find a place 2" })).toBeInTheDocument();
  });

  it("draws the old typed boxes alone when there is no picker", () => {
    open(vi.fn().mockResolvedValue(ok), false);
    expect(screen.queryByRole("combobox", { name: /Find a place/ })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Latitude 2" })).toBeInTheDocument();
  });

  it("fills the empty row's boxes and name from a place, and saves what the boxes hold", async () => {
    const save = open();
    await pickKkNagarInRow(2);
    expect(screen.getByRole("textbox", { name: "Latitude 2" })).toHaveValue("13.041812");
    expect(screen.getByRole("textbox", { name: "Longitude 2" })).toHaveValue("80.2341");
    expect(screen.getByRole("textbox", { name: "Label 2" })).toHaveValue("KK Nagar");
    // The first row was not touched.
    expect(screen.getByRole("textbox", { name: "Latitude 1" })).toHaveValue("13.0067");
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/places/autocomplete?q=kk+n&source=admin_picker",
    );

    // The boxes stay editable: the admin corrects one by hand before saving.
    const longitude = screen.getByRole("textbox", { name: "Longitude 2" });
    await userEvent.clear(longitude);
    await userEvent.type(longitude, "80.25");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as { localities: unknown[] };
    expect(sent.localities[1]).toEqual({
      label: "KK Nagar",
      lat: "13.041812",
      lng: "80.25",
      radiusKm: "3",
    });
  });

  it("keeps the name the admin typed when a place is chosen for a row that has one", async () => {
    open();
    await pickKkNagarInRow(1);
    expect(screen.getByRole("textbox", { name: "Label 1" })).toHaveValue("Adyar");
    expect(screen.getByRole("textbox", { name: "Latitude 1" })).toHaveValue("13.041812");
  });

  it("when suggestions are unavailable says so and the typed boxes still save", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const save = open();
    await userEvent.type(screen.getByRole("combobox", { name: "Find a place 2" }), "kk nagar");
    expect(
      (await screen.findAllByText(places.unavailable.title, undefined, { timeout: 2000 }))[0],
    ).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Label 2" }), "KK Nagar");
    await userEvent.type(screen.getByRole("textbox", { name: "Latitude 2" }), "13.0418");
    await userEvent.type(screen.getByRole("textbox", { name: "Longitude 2" }), "80.2341");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as { localities: unknown[] };
    expect(sent.localities[1]).toEqual({
      label: "KK Nagar",
      lat: "13.0418",
      lng: "80.2341",
      radiusKm: "3",
    });
  });

  it("does not save the form when Enter is pressed in the place box", async () => {
    const save = open();
    await userEvent.type(screen.getByRole("combobox", { name: "Find a place 2" }), "ab{Enter}");
    expect(save).not.toHaveBeenCalled();
  });
});
