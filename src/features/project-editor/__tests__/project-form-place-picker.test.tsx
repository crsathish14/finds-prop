// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPlacePicker } from "@/features/search/admin-place-picker.client";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { changeField } from "../../../../tests/select";
import type { MediaStorage } from "../media-storage";
import type { ProjectDone } from "../project-service";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { ProjectForm } = await import("../project-form.client");

const words = en.admin.projectForm;
const places = en.domain.places;
const BUILDER_ID = "22222222-2222-4222-8222-222222222222";
const fetchMock = vi.fn();

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const answerNavalur = () =>
  Promise.resolve(
    json({
      ok: true,
      data: [
        {
          id: "p1",
          label: "Navalur",
          detail: "Chennai, Tamil Nadu, India",
          kind: "area",
          lat: 12.84701234,
          lng: 80.2271,
        },
      ],
    }),
  );

const done = (): ActionResult<ProjectDone> => ({
  ok: true,
  data: {
    projectId: "11111111-1111-4111-8111-111111111111",
    slug: "kadal-vista",
    previousSlug: null,
    moderation: "approved",
    previousModeration: "approved",
  },
});

const storage: MediaStorage = {
  upload: vi.fn(async () => true),
  remove: vi.fn(async () => undefined),
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockReset();
  fetchMock.mockImplementation(answerNavalur);
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

function open(scope: "admin" | "builder" = "admin", withPicker = true) {
  const save = vi.fn(async () => done());
  renderWithMessages(
    <ProjectForm
      scope={scope}
      project={null}
      {...(scope === "admin"
        ? { builders: [{ id: BUILDER_ID, name: "Kadal Homes", active: true }], forms: [] }
        : {})}
      save={save as never}
      backHref="/admin/projects"
      editBase="/admin/projects"
      storage={storage}
      mediaBaseUrl="https://storage.example.test"
      {...(withPicker ? { placePicker: AdminPlacePicker } : {})}
    />,
  );
  return save;
}

const box = (name: string) => screen.getByRole("textbox", { name: new RegExp(`^${name}`) });
const picker = () => screen.getByRole("combobox", { name: "Find a place" });

describe("UT-project-form with the place picker (ADR-140)", () => {
  it.each(["admin", "builder"] as const)(
    "puts the Find a place box in the Location section for the %s",
    (scope) => {
      open(scope);
      const location = screen.getByRole("region", { name: words.sections.location.title });
      expect(within(location).getByRole("combobox", { name: "Find a place" })).toBeInTheDocument();
    },
  );

  it("is not there when the page gives no picker", () => {
    open("admin", false);
    expect(screen.queryByRole("combobox", { name: "Find a place" })).toBeNull();
    expect(box(words.fields.latitude)).toBeInTheDocument();
  });

  it("fills latitude and longitude from the place chosen, leaves locality and address alone, and saves them", async () => {
    const save = open();
    const choose = (label: string, value: string) =>
      changeField(screen.getByRole("combobox", { name: new RegExp(`^${label}`) }), value);
    await userEvent.type(box(words.fields.name), "Kadal Vista");
    await choose(words.fields.builder, BUILDER_ID);
    await choose(words.fields.projectType, "residential");
    await choose(words.fields.propertyType, "apartment");
    await choose(words.fields.projectStatus, "ready_to_move");
    await userEvent.type(box("Starting price"), "78,00,000");
    await choose(words.fields.priceType, "basic");
    await userEvent.type(
      box("Why is RERA not applicable"),
      "Below the size that needs registration.",
    );
    await userEvent.type(box(words.fields.locality), "OMR Navalur");
    await userEvent.type(picker(), "nava");
    await userEvent.click(
      await screen.findByRole("option", { name: /Navalur/ }, { timeout: 2000 }),
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/places/autocomplete?q=nava&source=admin_picker",
    );
    expect(box(words.fields.latitude)).toHaveValue("12.847012");
    expect(box(words.fields.longitude)).toHaveValue("80.2271");
    expect(box(words.fields.locality)).toHaveValue("OMR Navalur");
    expect(box(words.fields.address)).toHaveValue("");

    await userEvent.click(screen.getByRole("button", { name: words.save.save }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(sent[0]).toMatchObject({ latitude: "12.847012", longitude: "80.2271" });
  });

  it("keeps the boxes editable after a pick", async () => {
    open();
    await userEvent.type(picker(), "nava");
    await userEvent.click(
      await screen.findByRole("option", { name: /Navalur/ }, { timeout: 2000 }),
    );
    const latitude = box(words.fields.latitude);
    await userEvent.clear(latitude);
    await userEvent.type(latitude, "12.9");
    expect(latitude).toHaveValue("12.9");
    expect(box(words.fields.longitude)).toHaveValue("80.2271");
  });

  it("says suggestions are unavailable and the typed boxes still work", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    open();
    await userEvent.type(picker(), "navalur");
    expect(
      (await screen.findAllByText(places.unavailable.title, undefined, { timeout: 2000 }))[0],
    ).toBeInTheDocument();
    await userEvent.type(box(words.fields.latitude), "12.8");
    expect(box(words.fields.latitude)).toHaveValue("12.8");
  });

  it("does not save the project when Enter is pressed in the place box", async () => {
    const save = open();
    await userEvent.type(picker(), "ab{Enter}");
    expect(save).not.toHaveBeenCalled();
  });
});
